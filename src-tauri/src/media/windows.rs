#![cfg(target_os = "windows")]

use super::provider::{is_spotify_source, MediaSessionError, MediaSessionProvider, NowPlaying};
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager as SessionManager;

pub struct WindowsMediaProvider;

impl WindowsMediaProvider {
    pub fn new() -> Self {
        Self
    }
}

impl MediaSessionProvider for WindowsMediaProvider {
    fn get_now_playing(&self) -> Result<NowPlaying, MediaSessionError> {
        // The WinRT call is async; Tauri commands already run off the main
        // thread, so blocking here is safe and keeps the trait's public API
        // synchronous for both platforms.
        let manager = SessionManager::RequestAsync()
            .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?
            .get()
            .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?;

        let session = match manager.GetCurrentSession() {
            Ok(s) => s,
            // No session at all (nothing playing anywhere) is a valid idle
            // state, not an error.
            Err(_) => {
                log::debug!("GetCurrentSession() returned no session");
                return Ok(NowPlaying::idle());
            }
        };

        let app_id = session
            .SourceAppUserModelId()
            .map(|s| s.to_string())
            .unwrap_or_default();
        log::debug!("SMTC current session: source_app_user_model_id = {app_id:?}");

        if !is_spotify_source(&app_id) {
            // This is the thing to check in the log output if Spotify is
            // playing but not recognized: does app_id actually contain
            // "spotify" in some form, or is GetCurrentSession() pointing
            // at a different app entirely? The latter is a real, known
            // limitation of this API — see the module notes.
            return Ok(NowPlaying::idle());
        }

        let props = session
            .TryGetMediaPropertiesAsync()
            .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?
            .get()
            .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?;

        let title = props.Title().map(|s| s.to_string()).unwrap_or_default();

        if title.is_empty() {
            // Session exists but reports no track — treat as idle rather
            // than surfacing an empty-titled "now playing" card.
            return Ok(NowPlaying::idle());
        }

        let artist = props.Artist().map(|s| s.to_string()).unwrap_or_default();
        let album = props.AlbumTitle().ok().map(|s| s.to_string());

        Ok(NowPlaying {
            is_playing: true,
            artist: Some(artist),
            title: Some(title),
            album,
            // Embedded artwork extraction from the SMTC thumbnail stream is
            // scoped out of this module — the UI gets its thumbnails from
            // YouTube search results (FR6) and doesn't strictly need OS
            // album art for v1. Revisit as its own small module if the
            // "now playing" header needs it later.
            artwork_url: None,
            source_app: Some(app_id),
        })
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// Requires a real Windows session with Spotify actively playing.
    /// Not run in CI (see Phase 6 testing notes) — run manually with:
    ///   cargo test --package app -- --ignored get_now_playing_live
    #[test]
    #[ignore]
    fn get_now_playing_live() {
        let provider = WindowsMediaProvider::new();
        let result = provider.get_now_playing().expect("provider call failed");
        println!("{result:#?}");
        // Manual check: confirm artist/title match what's actually playing.
    }
}
