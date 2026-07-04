"""
=============================================================================
SCRIPT NAME: gliner_daemon.py
=============================================================================

DESCRIPTION:
    Local HTTP daemon that runs a GLiNER model for PII (personally
    identifiable information) detection. Listens on two TCP ports (HTTP
    and HTTPS) under 127.0.0.1 only and exposes a /v1/detect endpoint
    that accepts text and returns detected PII spans. Designed as a
    drop-in replacement for the OPF daemon so that opfClient.ts can call
    either endpoint with minimal code changes.

    The daemon lazy-loads the GLiNER model on the first /v1/detect
    request (cold start ~7 s) and unloads it after 10 minutes of
    inactivity to reclaim memory. Detection applies a 0.7 confidence
    threshold, a stoplist of common false-positive terms (ethnic
    adjectives, day names, legal roles, etc.), and a prefix-trim for
    person spans ("Mr. Smith" -> "Smith"). Also provides a browser-
    bridge HTML page at /bridge that proxies requests via postMessage,
    allowing HTTPS web apps (e.g. the California Law Chatbot on Vercel)
    to communicate with the local daemon.

INPUT FILES:
    (none -- this script is a network daemon. SSL certificate and key
    files may be specified via --cert-file/--key-file CLI arguments,
    and the GLiNER model is loaded from HuggingFace hub or local
    cache; none of these are hard-coded paths.)

OUTPUT FILES:
    (none -- this script only logs to stderr and writes JSON responses
    over HTTP. No persistent files are produced.)

VERSION: 1.0
LAST UPDATED: 2026-06-05
AUTHOR: Arjun Divecha

DEPENDENCIES:
    - gliner (PyPI package)
    - Python standard library: http.server, ssl, json, logging,
      threading, time

USAGE:
    python gliner_daemon.py
    python gliner_daemon.py --port 47841 --https-port 47842 \\
        --cert-file /path/to/cert.pem --key-file /path/to/key.pem

NOTES:
    - Binds only to 127.0.0.1 by default; refuses non-loopback hosts.
    - HTTPS mode requires --cert-file and --key-file.
    - The model name can be overridden with the GLINER_MODEL env var.
    - The detection threshold can be overridden with GLINER_THRESHOLD.
=============================================================================
"""
from __future__ import annotations

import json
import logging
import os
import ssl
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional

# Suppress transformers progress noise
os.environ.setdefault('TRANSFORMERS_VERBOSITY', 'error')
os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')

VERSION = "0.1.0"
DEFAULT_PORT = 47841
DEFAULT_HTTPS_PORT = 47842
IDLE_UNLOAD_SECONDS = 600
IDLE_CHECK_INTERVAL_SECONDS = 30
DETECT_THRESHOLD = float(os.environ.get('GLINER_THRESHOLD', '0.7'))
MODEL_NAME = os.environ.get('GLINER_MODEL', 'urchade/gliner_multi_pii-v1')

logger = logging.getLogger("gliner-daemon")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)

# GLiNER labels we ask for. Map to V2 SpanCategory.
LABEL_MAP = {
    'person': 'name',
    'full name': 'name',
    'first name': 'name',
    'last name': 'name',
    'full address': 'street_address',
    'address': 'street_address',
    'phone number': 'phone',
    'email address': 'email',
    'email': 'email',
    'date': 'date',
    'date of birth': 'date',
    'social security number': 'ssn',
    'credit card number': 'credit_card',
    'driver license': 'driver_license',
    'medical condition': 'medical_record',
    'patient id': 'medical_record',
    'zip code': 'zip',
    'postal code': 'zip',
}
GLINER_LABELS = list(LABEL_MAP.keys())

# Stoplist matched case-insensitively against the FULL span text.
STOPLIST_LOWER = {
    # Salutations / titles
    'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'hon.', 'sir', 'madam',
    'mr', 'mrs', 'ms', 'dr', 'prof', 'hon',
    # Generic legal roles (not personal names)
    'petitioner', 'respondent', 'plaintiff', 'defendant', 'appellant',
    'appellee', 'client', 'witness', 'co-counsel', 'co-trustee',
    'co-trustees', 'executor', 'executrix', 'trustee', 'trustees',
    'beneficiary', 'beneficiaries', 'grantor', 'settlor', 'guardian',
    'conservator', 'fiduciary', 'attorney', 'counsel', 'lawyer',
    'judge', 'justice', 'magistrate', 'clerk', 'court reporter',
    'witness', 'declarant', 'affiant', 'surviving spouse',
    # Generic professions
    'architect', 'engineer', 'doctor', 'physician', 'nurse', 'teacher',
    'professor', 'student', 'resident', 'partner', 'associate',
    'consultant', 'manager', 'director', 'officer', 'analyst',
    'developer', 'designer', 'accountant', 'auditor', 'pharmacist',
    'therapist', 'counselor', 'researcher', 'pilot', 'driver',
    'mechanic', 'carpenter', 'electrician', 'plumber',
    'boeing engineer', 'cisco engineer',
    # Days/months/time
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'sunday', 'morning', 'afternoon', 'evening', 'night', 'noon',
    'midnight', '2 pm', '2 am', '2pm', '2am', 'am', 'pm',
    'january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december',
    # Hyphenated ethnic/national adjectives — these describe a community,
    # not a specific person. The compound-risk pass picks up the
    # privacy signal when combined with other attributes.
    'korean-american', 'vietnamese-american', 'iranian-american',
    'mexican-american', 'chinese-american', 'japanese-american',
    'indian-american', 'filipino-american', 'african-american',
    'asian-american', 'mexican american', 'iranian american',
    'korean american', 'vietnamese american', 'chinese american',
    'japanese american', 'indian american', 'filipino american',
    'african american', 'asian american',
    # Bare nationality / ethnic adjectives
    'russian', 'mexican', 'lebanese', 'chinese', 'korean', 'vietnamese',
    'japanese', 'indian', 'filipino', 'african', 'asian', 'european',
    'middle eastern', 'european', 'persian', 'arab', 'hispanic', 'latino',
    'latina', 'latinx',
    'salvadoran', 'guatemalan', 'honduran', 'nicaraguan', 'colombian',
    'venezuelan', 'argentinian', 'peruvian', 'bolivian',
    'cambodian', 'thai', 'laotian', 'burmese', 'malaysian', 'indonesian',
    'singaporean', 'taiwanese', 'mongolian', 'tibetan', 'nepalese',
    'pakistani', 'bangladeshi', 'sri lankan', 'afghani', 'iraqi', 'iranian',
    'syrian', 'jordanian', 'palestinian', 'turkish', 'kurdish', 'armenian',
    'ethiopian', 'eritrean', 'somali', 'nigerian', 'ghanaian', 'kenyan',
    'south african', 'egyptian', 'moroccan',
    'brazilian', 'portuguese', 'spanish', 'italian', 'french', 'german',
    'dutch', 'irish', 'scottish', 'welsh', 'polish', 'ukrainian', 'romanian',
    'hungarian', 'czech', 'slovak', 'serbian', 'croatian', 'greek',
    'hmong', 'punjabi', 'gujarati', 'bengali', 'tamil', 'telugu',
    'cantonese', 'mandarin', 'hokkien', 'shanghainese',
    'native american',
    # Religious adjectives / clergy
    'orthodox', 'catholic', 'protestant', 'buddhist', 'muslim', 'jewish',
    'hindu', 'sikh', 'mormon', 'evangelical', 'pastor', 'priest', 'rabbi',
    'imam', 'monk', 'nun', 'bishop',
    # More generic occupations
    'restaurateur', 'proprietor', 'owner', 'founder', 'entrepreneur',
    'executive', 'CEO', 'CFO', 'CTO', 'COO', 'president', 'vice president',
    # Common org names — when mentioned generically, not as a client.
    'wells fargo', 'cisco', 'boeing', 'google', 'apple', 'meta',
    'microsoft', 'amazon', 'tesla', 'salesforce', 'oracle', 'intel',
    'nvidia', 'ucsf', 'ucla', 'usc', 'stanford', 'berkeley', 'caltech',
    'kaiser', 'bank of america', 'chase', 'citibank',
    # CA cities/regions used as generic geographic, not addresses
    'los angeles', 'san francisco', 'san diego', 'san jose', 'sacramento',
    'fresno', 'oakland', 'berkeley', 'long beach', 'cupertino',
    'palo alto', 'mountain view', 'sunnyvale', 'pasadena', 'beverly hills',
    'la jolla', 'malibu', 'santa monica', 'santa barbara', 'santa clara',
    'fremont', 'hayward', 'walnut creek', 'orinda', 'lafayette',
    'marin county', 'alameda county', 'orange county', 'santa clara county',
    'silicon valley', 'bay area', 'sf bay area',
    # Neighborhood / district names — generic geographic markers, not
    # full addresses (no street number/name). Compound-risk pass still
    # picks up the privacy signal when paired with other attributes.
    'sunset district', 'pico-union', 'koreatown', 'hollywood hills',
    'mission district', 'chinatown', 'little tokyo', 'little saigon',
    'pico-robertson', 'pasadena hills', 'beverly grove', 'east la',
    'west la', 'downtown la', 'east oakland', 'west oakland',
    'sherman oaks', 'encino', 'studio city', 'van nuys',
    'mar vista', 'venice', 'glassell park', 'silver lake',
    'echo park', 'westwood', 'culver city', 'inglewood',
    'bishop', 'roseville', 'visalia', 'bakersfield',
    'cambodia town', 'thai town',
    # Schools / institutions commonly mentioned as third-party orgs
    'bishop o\'dowd', "bishop o'dowd",
    # Common legal phrases
    'family trust', 'common trust', 'living trust', 'revocable trust',
    'irrevocable trust', 'special needs trust', 'pot trust',
    # Relationship words
    'twins', 'triplets', 'siblings',
    # "my client", "my counsel" — possessive-attached role phrases
    'my client', 'my counsel', 'my attorney', 'my trustee',
    'her client', 'his client', 'their client',
    'the client', 'the trustee', 'the beneficiary', 'the executor',
    # Generic user/system role words that GLiNER mistags as person
    'user', 'users', 'the user', 'the system', 'the model', 'the agent',
    'the assistant', 'the bot', 'the chatbot',
    # Pronouns GLiNER occasionally mis-tags as person ("I want to draft a
    # will" -> "I" flagged as CLIENT_001). Full-span match only, so real
    # names containing these letters are unaffected. (Added 2026-07-04;
    # keep in sync with services/sanitization/glinerPostProcess.ts.)
    'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours',
    'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
    'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'who', 'whom', 'someone', 'somebody', 'anyone',
    'anybody', 'everyone', 'everybody', 'no one', 'nobody',
    # Government bodies, public offices & agencies. In statute/bill text these
    # are the SUBJECT or AUTHORITY, never a private client — but GLiNER tags the
    # Title-Case phrase as a 'person'. (Reported FP: SB 524 bill title.)
    'law enforcement', 'law enforcement agency', 'law enforcement agencies',
    'secretary of state', 'attorney general', 'district attorney',
    'public defender', 'state controller', 'state treasurer',
    'governor', 'lieutenant governor', 'legislature', 'state legislature',
    'state assembly', 'state senate', 'general assembly',
    'board of supervisors', 'city council', 'county counsel',
    'department of justice', 'department of motor vehicles',
    'franchise tax board', 'employment development department',
    'department of corrections', 'department of public health',
    'highway patrol', 'california highway patrol',
    'public utilities commission', 'air resources board',
    # Legislative / technical SUBJECT terms (the topic a bill regulates —
    # never client PII). Exact-full-span match only, so a real org like
    # "Artificial Intelligence Corp." (a longer span) is unaffected.
    'artificial intelligence', 'machine learning', 'generative ai',
    'automated decision', 'automated decision system',
    'automated decision systems', 'facial recognition',
    'autonomous vehicle', 'autonomous vehicles', 'data broker',
    'criminal justice', 'public safety',
}

PREFIX_TRIM = [
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Hon.', 'Honorable',
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Hon',
    'Witness', 'Petitioner', 'Respondent', 'Plaintiff', 'Defendant',
    'Appellant', 'Appellee', 'Co-counsel', 'Co-trustee', 'Counsel',
    'Attorney', 'Client', 'client', 'Trustee', 'Beneficiary',
    'Executor', 'Settlor', 'Grantor', 'Guardian',
]


def trim_prefix(text: str, start: int) -> tuple[str, int]:
    for p in PREFIX_TRIM:
        if text.startswith(p + ' '):
            return text[len(p) + 1:], start + len(p) + 1
    return text, start


class GLiNERService:
    def __init__(self) -> None:
        self._model: Optional[Any] = None
        self._lock = threading.Lock()
        self._last_request_at: Optional[float] = None
        self._started_at = time.time()

    @property
    def model_loaded(self) -> bool:
        return self._model is not None

    @property
    def last_request_age_s(self) -> Optional[float]:
        if self._last_request_at is None:
            return None
        return time.time() - self._last_request_at

    @property
    def uptime_s(self) -> float:
        return time.time() - self._started_at

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        logger.info(f"loading GLiNER model {MODEL_NAME} (cold start)")
        t0 = time.time()
        from gliner import GLiNER  # type: ignore[import-not-found]
        self._model = GLiNER.from_pretrained(MODEL_NAME)
        # Warmup
        try:
            self._model.predict_entities("warmup", GLINER_LABELS, threshold=DETECT_THRESHOLD)
        except Exception as e:
            logger.warning(f"warmup failed: {e}")
        logger.info(f"GLiNER model loaded in {time.time() - t0:.2f}s")

    def detect(self, text: str) -> dict[str, Any]:
        with self._lock:
            self._ensure_loaded()
            t0 = time.time()
            assert self._model is not None
            raw = self._model.predict_entities(
                text, GLINER_LABELS, threshold=DETECT_THRESHOLD
            )
            elapsed_ms = (time.time() - t0) * 1000.0
            self._last_request_at = time.time()

        out_spans = []
        for r in raw:
            cat = LABEL_MAP.get(r['label'].lower())
            if not cat:
                continue
            span_text = r['text']
            span_start = r['start']
            if cat == 'name':
                span_text, span_start = trim_prefix(span_text, span_start)
            if span_text.strip().lower() in STOPLIST_LOWER:
                continue
            if not span_text.strip():
                continue
            # A one-character "name" is never a real personal name — it's
            # the model mis-tagging a pronoun, initial, or stray letter.
            if cat == 'name' and len(span_text.strip()) < 2:
                continue
            # OPF-daemon-compatible label naming so opfClient maps them.
            # Use private_person/private_address/etc. so the existing
            # opfLabelToCategory switch picks them up unchanged.
            opf_label = {
                'name': 'private_person',
                'street_address': 'private_address',
                'phone': 'private_phone',
                'email': 'private_email',
                'date': 'date',
                'ssn': 'account_number',
                'credit_card': 'account_number',
                'driver_license': 'account_number',
                'medical_record': 'medical_record',
                'zip': 'zip',
            }.get(cat, cat)
            out_spans.append({
                'label': opf_label,
                'start': span_start,
                'end': r['end'],
                'text': span_text,
                'placeholder': f'<{opf_label.upper()}>',
            })

        return {
            'spans': out_spans,
            'elapsed_ms': round(elapsed_ms, 1),
            'model_loaded': True,
        }

    def maybe_unload(self) -> bool:
        with self._lock:
            if self._model is None or self._last_request_at is None:
                return False
            idle = time.time() - self._last_request_at
            if idle < IDLE_UNLOAD_SECONDS:
                return False
            logger.info(f"idle {idle:.0f}s — unloading GLiNER model")
            self._model = None
            try:
                import gc
                gc.collect()
            except Exception:
                pass
        return True


def _idle_watcher(service: GLiNERService) -> None:
    while True:
        time.sleep(IDLE_CHECK_INTERVAL_SECONDS)
        try:
            service.maybe_unload()
        except Exception as e:
            logger.exception(f"idle watcher error: {e}")


class GLiNERHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


class GLiNERRequestHandler(BaseHTTPRequestHandler):
    server_version = f"gliner-daemon/{VERSION}"

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        if self.path == "/v1/health":
            svc: GLiNERService = self.server.gliner_service  # type: ignore[attr-defined]
            self._send_json(200, {
                "ok": True,
                "model_loaded": svc.model_loaded,
                "uptime_s": round(svc.uptime_s, 1),
                "last_request_age_s": (
                    None if svc.last_request_age_s is None
                    else round(svc.last_request_age_s, 1)
                ),
                "idle_unload_seconds": IDLE_UNLOAD_SECONDS,
                "threshold": DETECT_THRESHOLD,
                "model": MODEL_NAME,
                "version": VERSION,
            })
            return
        if self.path == "/bridge":
            self._send_html(200, _bridge_html())
            return
        self._send_json(404, {"error": "not_found", "path": self.path})

    def _send_html(self, status: int, html: str) -> None:
        payload = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self) -> None:
        if self.path != "/v1/detect":
            self._send_json(404, {"error": "not_found", "path": self.path})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 10 * 1024 * 1024:
                self._send_json(400, {"error": "invalid_content_length"})
                return
            raw = self.rfile.read(length)
            try:
                body = json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError:
                self._send_json(400, {"error": "invalid_json"})
                return
            text = body.get("text")
            if not isinstance(text, str):
                self._send_json(400, {"error": "missing_or_invalid_text"})
                return

            svc: GLiNERService = self.server.gliner_service  # type: ignore[attr-defined]
            t0 = time.time()
            result = svc.detect(text)
            total_ms = (time.time() - t0) * 1000.0
            logger.info(
                f"detect len={len(text)} spans={len(result['spans'])} "
                f"elapsed_ms={result['elapsed_ms']} total_ms={total_ms:.1f}"
            )
            self._send_json(200, result)
        except Exception as e:
            logger.exception(f"detect error: {e}")
            self._send_json(500, {"error": "internal_error", "message": str(e)})


def _bridge_html() -> str:
    """
    Browser bridge HTML, ported from opf_daemon.py 2026-05-16 so the
    GLiNER daemon can serve it directly and the OPF daemon becomes
    unneeded. Browsers on HTTPS pages cannot fetch http://127.0.0.1
    directly, so the V2 app opens this page in a popup and proxies
    requests through it via postMessage.

    Allowlist covers both V1 prod (california-law-chatbot.vercel.app)
    and the new V2 prod URL (california-law-chatbot-v2.vercel.app) plus
    the V1/V2 preview-URL families and localhost dev.
    """
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Privacy Filter Bridge</title>
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #111827;
      background: #f8fafc;
    }}
    main {{
      max-width: 520px;
      border: 1px solid #d1d5db;
      border-radius: 14px;
      background: #fff;
      padding: 28px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
    }}
    h1 {{ margin: 0 0 10px; font-size: 22px; }}
    p {{ margin: 0 0 10px; line-height: 1.5; color: #4b5563; }}
    .status {{ margin-top: 18px; color: #047857; font-weight: 700; }}
  </style>
</head>
<body>
  <main>
    <h1>Privacy filter connected</h1>
    <p>This local window lets Safari talk to the on-device privacy filter.</p>
    <p>Keep it open while using the chatbot. Client information is filtered on this Mac before anything is sent out.</p>
    <div class="status" id="status">Waiting for chatbot...</div>
  </main>
  <script>
    const VERSION = {json.dumps(VERSION)};
    const statusEl = document.getElementById('status');

    function isAllowedOrigin(origin) {{
      try {{
        const url = new URL(origin);
        if (url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) {{
          return true;
        }}
        if (url.protocol !== 'https:') return false;
        return (
          url.hostname === 'california-law-chatbot.vercel.app' ||
          url.hostname === 'california-law-chatbot-v2.vercel.app' ||
          (url.hostname.endsWith('.vercel.app') && (
            url.hostname.startsWith('california-law-chatbot-') ||
            url.hostname.startsWith('california-law-chatb-git-') ||
            url.hostname.startsWith('california-law-chatbot-v2-')
          ))
        );
      }} catch {{
        return false;
      }}
    }}

    async function callDaemon(message) {{
      const path = message.path === '/v1/detect' ? '/v1/detect' : '/v1/health';
      const init = {{
        method: message.method === 'POST' ? 'POST' : 'GET',
        headers: message.headers && typeof message.headers === 'object' ? message.headers : undefined,
        body: typeof message.body === 'string' ? message.body : undefined,
        cache: 'no-store',
      }};
      const response = await fetch(path, init);
      const text = await response.text();
      let body = null;
      if (text) {{
        try {{ body = JSON.parse(text); }} catch {{ body = {{ text }}; }}
      }}
      return {{ status: response.status, ok: response.ok, body }};
    }}

    window.addEventListener('message', async (event) => {{
      if (!isAllowedOrigin(event.origin)) return;
      const message = event.data || {{}};
      if (message.type !== 'opf-bridge-request' || typeof message.id !== 'string') return;
      try {{
        const result = await callDaemon(message);
        event.source.postMessage({{
          type: 'opf-bridge-response',
          id: message.id,
          ok: result.ok,
          status: result.status,
          body: result.body,
        }}, event.origin);
        statusEl.textContent = 'Connected to chatbot';
      }} catch (err) {{
        event.source.postMessage({{
          type: 'opf-bridge-response',
          id: message.id,
          ok: false,
          status: 0,
          error: err && err.message ? err.message : String(err),
        }}, event.origin);
      }}
    }});

    function announceReady() {{
      if (window.opener && !window.opener.closed) {{
        window.opener.postMessage({{ type: 'opf-bridge-ready', version: VERSION }}, '*');
      }}
    }}
    announceReady();
    setInterval(announceReady, 1000);
  </script>
</body>
</html>"""


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="GLiNER local detection daemon")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--https-port", type=int, default=DEFAULT_HTTPS_PORT)
    parser.add_argument("--cert-file", default=None)
    parser.add_argument("--key-file", default=None)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    if args.host not in ("127.0.0.1", "localhost", "::1"):
        logger.error(f"refusing to bind non-loopback host {args.host!r}")
        return 2

    service = GLiNERService()
    server = GLiNERHTTPServer((args.host, args.port), GLiNERRequestHandler)
    server.gliner_service = service  # type: ignore[attr-defined]

    https_server: GLiNERHTTPServer | None = None
    https_thread: threading.Thread | None = None
    if args.cert_file and args.key_file:
        try:
            https_server = GLiNERHTTPServer((args.host, args.https_port), GLiNERRequestHandler)
            https_server.gliner_service = service  # type: ignore[attr-defined]
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            if hasattr(ssl, "TLSVersion"):
                context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.load_cert_chain(certfile=args.cert_file, keyfile=args.key_file)
            https_server.socket = context.wrap_socket(https_server.socket, server_side=True)
        except Exception as e:
            logger.exception(f"failed to init HTTPS listener: {e}")
            if https_server is not None:
                https_server.server_close()
            https_server = None

    watcher = threading.Thread(target=_idle_watcher, args=(service,), daemon=True, name="idle-watcher")
    watcher.start()

    logger.info(f"GLiNER daemon v{VERSION} listening on http://{args.host}:{args.port}")
    if https_server is not None:
        https_thread = threading.Thread(target=https_server.serve_forever, daemon=True, name="https-server")
        https_thread.start()
        logger.info(f"GLiNER daemon v{VERSION} listening on https://{args.host}:{args.https_port}")
    logger.info(f"model={MODEL_NAME} threshold={DETECT_THRESHOLD} idle_unload={IDLE_UNLOAD_SECONDS}s")
    logger.info("model NOT loaded — first /v1/detect request will cold-start")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("shutdown requested")
    finally:
        if https_server is not None:
            https_server.shutdown()
            https_server.server_close()
        if https_thread is not None:
            https_thread.join(timeout=2)
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
