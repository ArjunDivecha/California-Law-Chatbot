// ============================================================================
// California Law Chatbot — Tauri desktop shell (phase 2: sidecar + SQLite)
// ============================================================================
// What this does: entry library for the Tauri 2 desktop wrapper around the
// existing React/Vite front end. Two launch modes:
//
//   1. Hot-reload dev (default `tauri dev`): the webview loads the Vite dev
//      server (http://localhost:5173 per ../tauri.conf.json), which proxies
//      /api/* to dev-server.js on :3000. Nothing is spawned here.
//
//   2. Desktop/self-contained (`yarn desktop`, overlaying
//      ../tauri.desktop.conf.json → devUrl/window :8477): the SIDECAR
//      (desktop-server.mjs) serves BOTH the built front end (dist/) and the
//      full V2 agent-loop API on http://127.0.0.1:8477, with sessions/audit
//      in local SQLite and all Upstash/Blob credentials stripped.
//
//      Sidecar startup ownership differs by build type, because the Tauri
//      CLI blocks waiting for devUrl before launching the app binary (a
//      Rust-side spawn would deadlock dev):
//        - dev (`tauri dev`): the CLI starts it via the overlay's
//          beforeDevCommand { wait: false }.
//        - release/packaged (or DESKTOP_SIDECAR=1): this file spawns it,
//          blocks setup until the port accepts connections (max ~15 s),
//          and kills the child on app exit.
//
// NOTE (spike-grade): the sidecar path is resolved from CARGO_MANIFEST_DIR
// at compile time (repo root = its parent), which is correct for `tauri dev`
// builds on this machine. Packaging (phase 3) replaces this with a bundled
// Tauri sidecar binary resolved from the app resources directory.
//
// File I/O: none directly (the spawned sidecar owns the SQLite DB — see
// desktop-server.mjs header for its paths).
// ============================================================================

use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, RunEvent};

struct SidecarChild(Mutex<Option<Child>>);

fn spawn_sidecar(port: &str) -> std::io::Result<Child> {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent dir")
        .to_path_buf();
    Command::new(root.join("node_modules/.bin/tsx"))
        .arg("desktop-server.mjs")
        .current_dir(&root)
        .env("DESKTOP_PORT", port)
        .spawn()
}

pub fn run() {
    let app = tauri::Builder::default()
        .manage(SidecarChild(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Release/packaged builds own the sidecar; dev builds leave it
            // to the CLI's beforeDevCommand (see header). DESKTOP_SIDECAR=1
            // forces the spawn in dev for testing this path.
            let should_spawn = !cfg!(debug_assertions)
                || std::env::var("DESKTOP_SIDECAR").as_deref() == Ok("1");
            if should_spawn {
                let port =
                    std::env::var("DESKTOP_PORT").unwrap_or_else(|_| "8477".to_string());
                let child = spawn_sidecar(&port)?;
                *app.state::<SidecarChild>().0.lock().unwrap() = Some(child);
                // Block setup until the sidecar accepts connections so the
                // webview's first load can't race it. ~15 s ceiling.
                let addr = format!("127.0.0.1:{port}");
                for _ in 0..150 {
                    if TcpStream::connect(&addr).is_ok() {
                        log::info!("sidecar ready on {addr}");
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(mut child) = app_handle
                .state::<SidecarChild>()
                .0
                .lock()
                .unwrap()
                .take()
            {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
