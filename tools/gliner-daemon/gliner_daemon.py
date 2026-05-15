"""
GLiNER local detection daemon — companion to the OPF daemon at
:47821/:47822. Adopted as the primary PII detector per
docs/phase-c-decision-2026-05-15.md.

Listens on:
  http://127.0.0.1:47841/v1/detect   (HTTP, browser-fallback)
  https://127.0.0.1:47842/v1/detect  (HTTPS — required for HTTPS pages)

Same JSON shape as the OPF daemon so opfClient.ts can call either with
minimal code change. Filters that the trap suite proved Phase C-clear:
  - threshold 0.7
  - stoplist of common-term FPs (ethnic adjectives, day names, etc.)
  - prefix-trim on person spans ("Mr. Smith" → "Smith", title untouched)

Lazy-loads the model on first /v1/detect call (~7s cold). Idle-unloads
after 10 minutes of inactivity. Bind 127.0.0.1 only — never network.
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
    'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'hon.', 'sir', 'madam',
    'mr', 'mrs', 'ms', 'dr', 'prof', 'hon',
    'petitioner', 'respondent', 'plaintiff', 'defendant', 'appellant',
    'appellee', 'client', 'witness', 'co-counsel', 'co-trustee',
    'co-trustees', 'executor', 'executrix', 'trustee', 'trustees',
    'beneficiary', 'beneficiaries', 'grantor', 'settlor', 'guardian',
    'conservator', 'fiduciary', 'attorney', 'counsel', 'lawyer',
    'judge', 'justice', 'magistrate', 'clerk', 'court reporter',
    'declarant', 'affiant', 'surviving spouse',
    'architect', 'engineer', 'doctor', 'physician', 'nurse', 'teacher',
    'professor', 'student', 'resident', 'partner', 'associate',
    'consultant', 'manager', 'director', 'officer', 'analyst',
    'developer', 'designer', 'accountant', 'auditor', 'pharmacist',
    'therapist', 'counselor', 'researcher', 'pilot', 'driver',
    'mechanic', 'carpenter', 'electrician', 'plumber',
    'restaurateur', 'proprietor', 'owner', 'founder', 'entrepreneur',
    'executive', 'CEO', 'CFO', 'CTO', 'COO', 'president', 'vice president',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'sunday', 'morning', 'afternoon', 'evening', 'night', 'noon',
    'midnight', '2 pm', '2 am', '2pm', '2am', 'am', 'pm',
    'january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december',
    'korean-american', 'vietnamese-american', 'iranian-american',
    'mexican-american', 'chinese-american', 'japanese-american',
    'indian-american', 'filipino-american', 'african-american',
    'asian-american', 'mexican american', 'iranian american',
    'korean american', 'vietnamese american', 'chinese american',
    'japanese american', 'indian american', 'filipino american',
    'african american', 'asian american',
    'russian', 'mexican', 'lebanese', 'chinese', 'korean', 'vietnamese',
    'japanese', 'indian', 'filipino', 'african', 'asian', 'european',
    'middle eastern', 'persian', 'arab', 'hispanic', 'latino', 'latina',
    'latinx',
    'orthodox', 'catholic', 'protestant', 'buddhist', 'muslim', 'jewish',
    'hindu', 'sikh', 'mormon', 'evangelical', 'pastor', 'priest', 'rabbi',
    'imam', 'monk', 'nun', 'bishop',
    'wells fargo', 'cisco', 'boeing', 'google', 'apple', 'meta',
    'microsoft', 'amazon', 'tesla', 'salesforce', 'oracle', 'intel',
    'nvidia', 'ucsf', 'ucla', 'usc', 'stanford', 'berkeley', 'caltech',
    'kaiser', 'bank of america', 'chase', 'citibank',
    'los angeles', 'san francisco', 'san diego', 'san jose', 'sacramento',
    'fresno', 'oakland', 'long beach', 'cupertino', 'palo alto',
    'mountain view', 'sunnyvale', 'pasadena', 'beverly hills', 'la jolla',
    'malibu', 'santa monica', 'santa barbara', 'santa clara',
    'fremont', 'hayward', 'walnut creek', 'orinda', 'lafayette',
    'marin county', 'alameda county', 'orange county', 'santa clara county',
    'silicon valley', 'bay area', 'sf bay area',
    "bishop o'dowd",
    'family trust', 'common trust', 'living trust', 'revocable trust',
    'irrevocable trust', 'special needs trust', 'pot trust',
    'twins', 'triplets', 'siblings',
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
        self._send_json(404, {"error": "not_found", "path": self.path})

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
