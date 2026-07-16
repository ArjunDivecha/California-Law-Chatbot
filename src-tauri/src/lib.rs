// ============================================================================
// California Law Chatbot — Tauri desktop shell (spike)
// ============================================================================
// What this does: entry library for the Tauri 2 desktop wrapper around the
// existing React/Vite front end. In dev it points the native webview at the
// Vite dev server (http://localhost:5173, configured in ../tauri.conf.json),
// which proxies /api/* to the local Express API (dev-server.js on :3000)
// running the same V2 agent-loop code that runs on Vercel in production.
// The Rust side currently hosts no app logic — it creates the window and
// (in debug builds) enables console logging. Local agent-loop hosting will
// move into a sidecar/local process in a later phase.
//
// File I/O: none. Configuration is read at compile time from
// /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/
//   .claude/worktrees/tauri-spike/src-tauri/tauri.conf.json
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
