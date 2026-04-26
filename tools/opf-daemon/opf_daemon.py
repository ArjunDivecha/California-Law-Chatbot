#!/usr/bin/env python3
"""
OPF Daemon — local HTTP service wrapping OpenAI Privacy Filter.

Architecture:
  - HTTP server bound to 127.0.0.1 only (loopback). Never accessible from the network.
  - Model is NOT loaded at process start. First /v1/detect request triggers a load (~1.4s).
  - A background thread watches idle time. If no requests for IDLE_UNLOAD_SECONDS,
    the model is dereferenced and Python's GC reclaims the memory (~3GB → ~50MB).
  - Subsequent first request after idle pays the 1.4s cold-start again.

Design intent: "on-demand" from the user's perspective — RAM is only resident
when the attorney is actively using the chatbot.

Endpoints:
  POST /v1/detect   { "text": "..." }
                  → { "spans": [{label, start, end, text}, ...],
                       "elapsed_ms": N, "model_loaded": bool }
  GET  /v1/health  → { "ok": true, "model_loaded": bool, "uptime_s": N,
                       "last_request_age_s": N | null, "version": "..." }

CORS: responds with `Access-Control-Allow-Origin: *` so the chatbot (running on
vercel.app) can call this localhost service.

Auth: none — bound to 127.0.0.1, only same-machine processes can reach it.
That matches the trust boundary (the user's Mac).

Logging: stderr. launchd captures both stdout and stderr per the plist config.
"""

from __future__ import annotations

import json
import logging
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional

VERSION = "0.1.0"
DEFAULT_PORT = 47821
IDLE_UNLOAD_SECONDS = 600  # 10 minutes
IDLE_CHECK_INTERVAL_SECONDS = 30
LOAD_TIMEOUT_SECONDS = 60   # cap on model load wall time

logger = logging.getLogger("opf-daemon")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)


class OPFService:
    """Holds the lazy-loaded OPF model and serves detect calls.

    Thread-safe: a single lock guards model load/unload and concurrent detect
    calls. The OPF model itself is read-only after load, but PyTorch's
    forward pass on CPU is parallelism-bounded so we serialize anyway.
    Detection latency is small enough (70-200ms) that serializing a single
    chat user is fine.
    """

    def __init__(self) -> None:
        self._model: Optional[Any] = None  # opf._api.OPF instance once loaded
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
        """Load the model if not yet loaded. Called inside the lock."""
        if self._model is not None:
            return
        logger.info("loading OPF model (cold start)")
        t0 = time.time()
        # Imports are inside the function so the import cost (PyTorch) is
        # paid only on first detect, not at process start. This keeps the
        # idle process tiny.
        from opf._api import OPF  # type: ignore[import-not-found]

        self._model = OPF(device="cpu", output_mode="typed")
        # Warm the runtime with a tiny call so the first user request doesn't
        # also pay the JIT/runtime init.
        try:
            self._model.redact("warmup")
        except Exception as e:
            logger.warning("warmup call failed: %s", e)
        logger.info("OPF model loaded in %.2fs", time.time() - t0)

    def detect(self, text: str) -> dict[str, Any]:
        with self._lock:
            self._ensure_loaded()
            t0 = time.time()
            assert self._model is not None
            result = self._model.redact(text)
            elapsed_ms = (time.time() - t0) * 1000.0
            self._last_request_at = time.time()

        # `result` is a RedactionResult dataclass; convert to a small JSON-safe
        # dict containing just the spans the chatbot needs.
        spans = [
            {
                "label": s.label,
                "start": s.start,
                "end": s.end,
                "text": s.text,
                "placeholder": s.placeholder,
            }
            for s in result.detected_spans
        ]
        return {
            "spans": spans,
            "elapsed_ms": round(elapsed_ms, 1),
            "model_loaded": True,
        }

    def maybe_unload(self) -> bool:
        """Drop the model reference if the idle threshold has elapsed.

        Returns True if a model was unloaded, False otherwise.
        """
        with self._lock:
            if self._model is None:
                return False
            if self._last_request_at is None:
                return False
            idle = time.time() - self._last_request_at
            if idle < IDLE_UNLOAD_SECONDS:
                return False
            logger.info(
                "idle %.0fs ≥ %ds — unloading OPF model",
                idle,
                IDLE_UNLOAD_SECONDS,
            )
            self._model = None
            # Best-effort RAM reclaim — PyTorch CPU caches plus Python GC.
            try:
                import gc

                gc.collect()
            except Exception:
                pass
        return True


def _idle_watcher(service: OPFService) -> None:
    """Background thread that periodically checks whether to unload."""
    while True:
        time.sleep(IDLE_CHECK_INTERVAL_SECONDS)
        try:
            service.maybe_unload()
        except Exception as e:
            logger.exception("idle watcher error: %s", e)


# ---------------------------------------------------------------------------
# HTTP layer
# ---------------------------------------------------------------------------

class OPFRequestHandler(BaseHTTPRequestHandler):
    server_version = f"opf-daemon/{VERSION}"

    # Suppress default HTTP access log noise; we log at the handler level.
    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
        return

    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        # Chrome's Private Network Access: an https public origin calling a
        # loopback address requires this preflight header. Sent on every
        # response so both preflight and actual responses satisfy PNA.
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send_json(204, {})

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/v1/health":
            svc: OPFService = self.server.opf_service  # type: ignore[attr-defined]
            self._send_json(
                200,
                {
                    "ok": True,
                    "model_loaded": svc.model_loaded,
                    "uptime_s": round(svc.uptime_s, 1),
                    "last_request_age_s": (
                        None
                        if svc.last_request_age_s is None
                        else round(svc.last_request_age_s, 1)
                    ),
                    "idle_unload_seconds": IDLE_UNLOAD_SECONDS,
                    "version": VERSION,
                },
            )
            return
        self._send_json(404, {"error": "not_found", "path": self.path})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/detect":
            self._send_json(404, {"error": "not_found", "path": self.path})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 10 * 1024 * 1024:  # 10MB cap
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

            svc: OPFService = self.server.opf_service  # type: ignore[attr-defined]
            t0 = time.time()
            result = svc.detect(text)
            total_ms = (time.time() - t0) * 1000.0
            logger.info(
                "detect len=%d spans=%d elapsed_ms=%.1f total_ms=%.1f",
                len(text),
                len(result["spans"]),
                result["elapsed_ms"],
                total_ms,
            )
            self._send_json(200, result)
        except Exception as e:
            logger.exception("detect error: %s", e)
            self._send_json(500, {"error": "internal_error", "message": str(e)})


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="OPF local detection daemon")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind address. Always 127.0.0.1 in production — never expose to network.",
    )
    args = parser.parse_args()

    if args.host not in ("127.0.0.1", "localhost", "::1"):
        logger.error(
            "refusing to bind to non-loopback host %r — daemon must be local-only",
            args.host,
        )
        return 2

    service = OPFService()
    server = ThreadingHTTPServer((args.host, args.port), OPFRequestHandler)
    server.opf_service = service  # type: ignore[attr-defined]

    watcher = threading.Thread(
        target=_idle_watcher, args=(service,), daemon=True, name="idle-watcher"
    )
    watcher.start()

    logger.info(
        "OPF daemon v%s listening on http://%s:%d (idle unload after %ds)",
        VERSION,
        args.host,
        args.port,
        IDLE_UNLOAD_SECONDS,
    )
    logger.info("model NOT loaded — first /v1/detect request will trigger cold start")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("shutdown requested")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
