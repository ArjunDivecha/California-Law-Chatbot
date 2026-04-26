# OPF Daemon

Local HTTP service wrapping [OpenAI Privacy Filter](https://github.com/openai/privacy-filter) so the California Law Chatbot can run client PII detection entirely on-device. The chatbot's browser process calls `http://127.0.0.1:47821/v1/detect` for every payload that's about to leave the device; the daemon returns spans + categories; the chatbot tokenizes locally before any network call.

Bound to `127.0.0.1` only — never reachable from the network.

## Install

```bash
cd tools/opf-daemon
./install.sh
```

The installer:
1. Verifies macOS + Python 3.10+.
2. Creates a venv at `~/.opf-daemon/venv`.
3. Clones `openai/privacy-filter` into `~/.opf-daemon/repo` and `pip install -e .`'s it.
4. Copies the daemon script to `~/.opf-daemon/opf_daemon.py`.
5. Writes a launchd agent at `~/Library/LaunchAgents/com.fflp.opf-daemon.plist`.
6. Loads the agent (auto-starts at user login from now on).
7. Probes `/v1/health`.

The first `/v1/detect` request after a fresh install will trigger a one-time download of the model (~2.8GB) into `~/.opf/privacy_filter/` and a ~1.4s warmup. Subsequent requests are 70–200ms while the model stays loaded; after 10 minutes idle the model unloads and RAM goes back to ~50MB.

## Uninstall

```bash
./uninstall.sh                 # keeps the model weights for reinstall
./uninstall.sh --purge-model   # also deletes ~/.opf/privacy_filter (~2.8GB)
```

## API

### `POST /v1/detect`

Request:
```json
{ "text": "i want to help arjun Divecha with a will" }
```

Response:
```json
{
  "spans": [
    { "label": "private_person", "start": 16, "end": 29, "text": "arjun Divecha", "placeholder": "<PRIVATE_PERSON>" }
  ],
  "elapsed_ms": 174.4,
  "model_loaded": true
}
```

### `GET /v1/health`

```json
{
  "ok": true,
  "model_loaded": false,
  "uptime_s": 1234.5,
  "last_request_age_s": null,
  "idle_unload_seconds": 600,
  "version": "0.1.0"
}
```

`model_loaded: false` is expected on a fresh / idle daemon. The first detect call lazy-loads the model.

## Operational notes

- **Logs**: `~/.opf-daemon/logs/daemon.{out,err}.log`. The daemon logs every detect call's length, span count, and elapsed ms.
- **Restart manually**: `launchctl kickstart -k gui/$(id -u)/com.fflp.opf-daemon`.
- **Stop temporarily**: `launchctl unload ~/Library/LaunchAgents/com.fflp.opf-daemon.plist`. Re-run `install.sh` or `launchctl load` to restart.
- **Idle unload threshold**: 10 minutes (configurable in `opf_daemon.py` via `IDLE_UNLOAD_SECONDS`).
- **RAM footprint**:
  - Idle (no requests yet, or after idle unload): ~50MB.
  - Loaded (during active use): ~3GB.
- **Port**: 47821 by default. Override with `OPF_DAEMON_PORT=12345 ./install.sh`. The chatbot hardcodes 47821 — change both if you change one.

## Troubleshooting

**Daemon won't start**: check `~/.opf-daemon/logs/daemon.err.log`. Most common cause is missing PyTorch — run `~/.opf-daemon/venv/bin/pip install torch` manually.

**`/v1/detect` returns 500 on first call**: probably the model download failed mid-flight. Delete `~/.opf/privacy_filter/` and call `/v1/detect` again to retry. Requires internet for the first call only.

**Browser CORS error**: the daemon sends `Access-Control-Allow-Origin: *` by design (loopback-only, no auth). If you see a CORS error, check that the request method is `POST` and the request URL is exactly `http://127.0.0.1:47821/v1/detect`.

**Daemon eats RAM forever**: the idle-unload thread should drop the model after 10 minutes. If RAM stays high while idle, check the logs for "idle … unloading OPF model" entries — if absent, the watcher thread crashed; restart the daemon.
