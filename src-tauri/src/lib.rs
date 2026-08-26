mod commands;
mod media;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init",
        // Single source of truth shared with the test suite —
        // see src-tauri/migrations/0001_init.sql and src/db/testExecutor.ts.
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

// The string Stronghold calls "password" here is not a user-entered
// secret — this app never prompts for a master password (judged
// unnecessary friction for what the vault protects: a YouTube API key,
// not financial credentials). It's a fixed, non-secret string run through
// Argon2id to derive the actual encryption key. This protects the vault
// file against casual/opportunistic reading (e.g. another process
// scanning app-data folders for plaintext keys) via the same OS file
// permissions any app-data file gets, hardened by Argon2's computational
// cost — it is NOT a defense against a determined attacker who has the
// installed binary in hand and can therefore derive this same value.
// That's a deliberate, documented tradeoff, not an oversight — see the
// Phase 6 Module 4 notes for the full reasoning.
fn stronghold_key_from_password(password: &str) -> Vec<u8> {
    const SALT: &[u8] = b"spotify-discovery-app-stronghold-salt-v1";
    let mut output = vec![0u8; 32];
    argon2::Argon2::default()
        .hash_password_into(password.as_bytes(), SALT, &mut output)
        .expect("argon2 hashing should not fail");
    output
}

/// Always shows and focuses the window — used by menu items, where
/// "Show" should never be a toggle-into-hiding surprise.
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Toggles visibility — used for the tray icon's own left-click, where a
/// toggle gesture is the expected behavior (click to open, click again to
/// dismiss).
fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Builds the tray icon and its menu. Requires `app.default_window_icon()`
/// to resolve, which in turn requires real icon files at the paths listed
/// under `bundle.icon` in tauri.conf.json — this repo does not ship those
/// binary assets yet (see the Phase 7 Module 4 notes). Run `cargo tauri
/// icon path/to/source.png` to generate the full set before this will
/// actually build.
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show, &settings, &quit]).build()?;

    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .expect("no default window icon — see build_tray's doc comment")
                .clone(),
        )
        .menu(&menu)
        .tooltip("Spotify Discovery Companion")
        // Left-click toggles the window directly; the menu (right-click,
        // or left-click if this were left at the default `true`) offers
        // Show/Settings/Quit instead of popping up on every single click.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => app.exit(0),
            // "Settings" just surfaces the window for now — it shows the
            // same view the window was last on rather than jumping
            // straight to the Settings screen. Wiring a cross-process
            // event so the tray menu can deep-link into the frontend's
            // view state is a reasonable follow-up, not done here to
            // keep this module's Rust-side surface area small.
            "show" | "settings" => show_main_window(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:cache.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_stronghold::Builder::new(stronghold_key_from_password).build())
        // Both plugins below were already used from the TypeScript side
        // (ResultCard/ApiKeyHelp's external-link opens, the HTTP client in
        // Module 3) but had never actually been registered here — an easy
        // gap to miss since the JS package installing successfully gives
        // no signal that the Rust-side half is also required. Caught
        // while building this module, not before.
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![commands::media::get_now_playing])
        .setup(|app| {
            build_tray(app)?;

            // Closing the window hides it instead of quitting — the app
            // only exits via the tray menu's Quit item, matching Phase 1's
            // "runs quietly in the background" requirement. Without this,
            // clicking the window's close button would kill the whole
            // background detection loop, defeating the point of the tray
            // icon existing at all.
            if let Some(window) = app.get_webview_window("main") {
                let window_handle = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_handle.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
