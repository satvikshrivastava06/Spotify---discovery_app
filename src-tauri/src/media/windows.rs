#![cfg(target_os = "windows")]

//! Windows implementation of [`MediaSessionProvider`] using the System Media
//! Transport Controls (SMTC) WinRT API.
//!
//! # The Session-Hijacking Problem
//!
//! `GlobalSystemMediaTransportControlsSessionManager::GetCurrentSession()`
//! returns only the single session that Windows considers "active" — whichever
//! app most recently interacted with the media keys or OS transport controls.
//! If the user paused a YouTube tab in Chrome before switching to Spotify,
//! Chrome holds the "current" slot and Spotify is invisible to a caller that
//! only checks that one slot.
//!
//! This module fixes that by scanning the full session list via `GetSessions()`
//! and applying its own ranking: an actively-**playing** Spotify session beats
//! a **paused** one, which beats any other status.  Non-Spotify sessions are
//! ignored entirely.
//!
//! # Playback status and `is_playing`
//!
//! `NowPlaying::is_playing` is `true` for both `Playing` **and** `Paused`
//! Spotify sessions.  A paused track is still the user's current focus — the
//! UI should keep showing results rather than resetting.  Only `Stopped`,
//! `Closed`, and unknown states collapse to `idle()`.

use super::provider::{is_spotify_source, MediaSessionError, MediaSessionProvider, NowPlaying};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as SmtcSession,
    GlobalSystemMediaTransportControlsSessionManager as SessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
};

/// Numeric priority for session selection — lower is better.
/// Playing=0 beats Paused=1, which beats everything else=2.
fn session_priority(status: PlaybackStatus) -> u8 {
    match status {
        PlaybackStatus::Playing => 0,
        PlaybackStatus::Paused => 1,
        _ => 2,
    }
}

/// Whether a playback status is meaningful enough to report a track.
/// Stopped, Closed, Opened, and Changing all mean the session has no
/// "current track" the user cares about — treat them as idle.
fn status_is_active(status: PlaybackStatus) -> bool {
    matches!(status, PlaybackStatus::Playing | PlaybackStatus::Paused)
}

/// Extract the AUMID (App User Model ID) from a session, falling back to an
/// empty string on any WinRT error rather than propagating it — a bad AUMID
/// just means this session won't pass the Spotify filter.
fn session_app_id(session: &SmtcSession) -> String {
    session
        .SourceAppUserModelId()
        .map(|s| s.to_string())
        .unwrap_or_default()
}

/// Read `PlaybackStatus` from a session, defaulting to `Closed` on error.
fn session_status(session: &SmtcSession) -> PlaybackStatus {
    session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .unwrap_or(PlaybackStatus::Closed)
}

/// Scan every registered SMTC session and return the best Spotify session,
/// or `None` if Spotify is not found / has no active playback.
///
/// "Best" is defined by `session_priority`: Playing wins over Paused; sessions
/// whose status is neither are excluded so we never surface a stale Spotify
/// session whose `is_active` is false.
fn find_best_spotify_session(manager: &SessionManager) -> Option<SmtcSession> {
    let sessions = manager.GetSessions().ok()?;
    let count = sessions.Size().unwrap_or(0);

    log::debug!("SMTC: found {count} total session(s)");

    let mut best: Option<(u8, SmtcSession)> = None;

    for i in 0..count {
        let session = match sessions.GetAt(i) {
            Ok(s) => s,
            Err(e) => {
                log::warn!("SMTC: GetAt({i}) failed: {e}");
                continue;
            }
        };

        let app_id = session_app_id(&session);
        let status = session_status(&session);

        log::debug!(
            "SMTC: session[{i}] app={app_id:?} status={}",
            status.0
        );

        if !is_spotify_source(&app_id) {
            continue; // not Spotify — skip
        }
        if !status_is_active(status) {
            log::debug!("SMTC: Spotify session[{i}] status is inactive — skipping");
            continue; // Stopped / Closed / etc. — not useful
        }

        let priority = session_priority(status);
        if best.as_ref().map_or(true, |(best_priority, _)| priority < *best_priority) {
            best = Some((priority, session));
        }
    }

    best.map(|(_, session)| session)
}

/// Pull `NowPlaying` data out of a session that has already been validated as
/// a Spotify session with an active status.  Returns `idle()` when the
/// `TryGetMediaPropertiesAsync` call succeeds but the title is empty — that
/// indicates a session in an initialising state, not a real track.
fn read_session_properties(
    session: &SmtcSession,
) -> Result<NowPlaying, MediaSessionError> {
    let props = session
        .TryGetMediaPropertiesAsync()
        .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?
        .get()
        .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?;

    let title = props.Title().map(|s| s.to_string()).unwrap_or_default();

    if title.is_empty() {
        // The session exists but Spotify has not yet populated track metadata
        // (happens briefly at startup or between tracks). Report idle so the
        // UI doesn't flash an empty card.
        log::debug!("SMTC: Spotify session has empty title — reporting idle");
        return Ok(NowPlaying::idle());
    }

    let artist = props.Artist().map(|s| s.to_string()).unwrap_or_default();
    let album = props.AlbumTitle().ok().map(|s| s.to_string());
    let app_id = session_app_id(session);

    Ok(NowPlaying {
        is_playing: true,
        artist: Some(artist),
        title: Some(title),
        album,
        // Embedded artwork extraction from the SMTC thumbnail stream is
        // deferred — the UI gets thumbnails from YouTube results and doesn't
        // need OS album art for v1.
        artwork_url: None,
        source_app: Some(app_id),
    })
}

// ---------------------------------------------------------------------------

pub struct WindowsMediaProvider;

impl WindowsMediaProvider {
    pub fn new() -> Self {
        Self
    }
}

impl MediaSessionProvider for WindowsMediaProvider {
    /// Returns the best available Spotify "now playing" state across all
    /// registered SMTC sessions.
    ///
    /// The WinRT calls are async; Tauri commands run off the main thread, so
    /// blocking with `.get()` here is safe and keeps the trait API sync.
    fn get_now_playing(&self) -> Result<NowPlaying, MediaSessionError> {
        let manager = SessionManager::RequestAsync()
            .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?
            .get()
            .map_err(|e| MediaSessionError::Unavailable(e.message().to_string()))?;

        match find_best_spotify_session(&manager) {
            Some(session) => read_session_properties(&session),
            None => {
                log::debug!("SMTC: no active Spotify session found — reporting idle");
                Ok(NowPlaying::idle())
            }
        }
    }
}

// ---------------------------------------------------------------------------

#[cfg(test)]
mod unit_tests {
    use super::*;

    /// `session_priority` must impose a strict Playing < Paused < other order.
    #[test]
    fn playing_has_lower_priority_value_than_paused() {
        assert!(session_priority(PlaybackStatus::Playing) < session_priority(PlaybackStatus::Paused));
    }

    #[test]
    fn paused_has_lower_priority_value_than_stopped() {
        assert!(session_priority(PlaybackStatus::Paused) < session_priority(PlaybackStatus::Stopped));
    }

    #[test]
    fn paused_has_lower_priority_value_than_closed() {
        assert!(session_priority(PlaybackStatus::Paused) < session_priority(PlaybackStatus::Closed));
    }

    /// Both Playing and Paused are "active" — a paused track is still the
    /// user's current focus and should keep the result panel visible.
    #[test]
    fn playing_and_paused_are_active() {
        assert!(status_is_active(PlaybackStatus::Playing));
        assert!(status_is_active(PlaybackStatus::Paused));
    }

    /// Stopped, Closed, Opened, and Changing should never surface as a track.
    #[test]
    fn stopped_closed_opened_changing_are_not_active() {
        assert!(!status_is_active(PlaybackStatus::Stopped));
        assert!(!status_is_active(PlaybackStatus::Closed));
        assert!(!status_is_active(PlaybackStatus::Opened));
        assert!(!status_is_active(PlaybackStatus::Changing));
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
        // Manual check: confirm artist/title match what Spotify is playing.
        // Also verify that the result isn't idle when something is playing.
    }

    /// Verifies that when Spotify is playing and Chrome has a paused video,
    /// the provider still returns Spotify's track.
    /// Run manually with Spotify playing + a Chrome tab with a paused video:
    ///   cargo test --package app -- --ignored get_now_playing_with_competing_chrome_session
    #[test]
    #[ignore]
    fn get_now_playing_with_competing_chrome_session() {
        let provider = WindowsMediaProvider::new();
        let result = provider.get_now_playing().expect("provider call failed");
        println!("{result:#?}");
        assert!(result.is_playing, "expected Spotify to win over Chrome");
        let source = result.source_app.as_deref().unwrap_or("");
        assert!(
            source.to_lowercase().contains("spotify"),
            "expected source_app to identify Spotify, got: {source:?}"
        );
    }
}
