# OPF Daemon

Local loopback service wrapping [OpenAI Privacy Filter](https://github.com/openai/privacy-filter) so the California Law Chatbot can run client PII detection entirely on-device. The chatbot's browser process calls `https://localhost:47822/v1/detect` first, with `http://127.0.0.1:47821/v1/detect` kept as a compatibility fallback; the daemon returns spans + categories; the chatbot tokenizes locally before any network call.

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
5. Creates a local HTTPS certificate and trusts it in the user's macOS Keychain so Safari can reach the loopback daemon from a deployed HTTPS site.
6. Writes a launchd agent at `~/Library/LaunchAgents/com.fflp.opf-daemon.plist`.
7. Loads the agent (auto-starts at user login from now on).
8. Probes `/v1/health`.

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
- **Ports**: HTTP uses 47821 and HTTPS uses 47822 by default. Override with `OPF_DAEMON_PORT=12345 OPF_DAEMON_HTTPS_PORT=12346 ./install.sh`. The chatbot probes the hardcoded default ports; change both if you change either one.

## Troubleshooting

**Daemon won't start**: check `~/.opf-daemon/logs/daemon.err.log`. Most common cause is missing PyTorch — run `~/.opf-daemon/venv/bin/pip install torch` manually.

**`/v1/detect` returns 500 on first call**: probably the model download failed mid-flight. Delete `~/.opf/privacy_filter/` and call `/v1/detect` again to retry. Requires internet for the first call only.

**Browser CORS or Safari connection error**: the daemon sends `Access-Control-Allow-Origin: *` by design (loopback-only, no auth). Safari requires the HTTPS loopback endpoint when the app is loaded from Vercel. Check `https://localhost:47822/v1/health` first, then `http://127.0.0.1:47821/v1/health` for backward-compatible HTTP.

**Daemon eats RAM forever**: the idle-unload thread should drop the model after 10 minutes. If RAM stays high while idle, check the logs for "idle … unloading OPF model" entries — if absent, the watcher thread crashed; restart the daemon.
