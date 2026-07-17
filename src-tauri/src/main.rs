// ============================================================================
// California Law Chatbot — Tauri desktop binary entry point (spike)
// ============================================================================
// What this does: thin executable wrapper that hands off to app_lib::run()
// (see lib.rs for the full description of the desktop shell).
// File I/O: none.
// ============================================================================

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  app_lib::run();
}
