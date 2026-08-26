use serde::Serialize;

/// Normalized now-playing state returned to the frontend.
///
/// Note: this is flattened (`is_playing: bool` + all-optional fields) rather
/// than a true tagged union — Rust/serde can't cleanly produce the
/// `{ isPlaying: true, ... } | { isPlaying: false }` shape sketched in the
/// Phase 5 TypeScript contract, so this is the concrete realization of it.
/// `is_playing: false` always means every other field is `None`.
#[derive(Debug, Clone, Serialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    pub is_playing: bool,
    pub artist: Option<String>,
    pub title: Option<String>,
    pub album: Option<String>,
    pub artwork_url: Option<String>,
    pub source_app: Option<String>,
}

impl NowPlaying {
    pub fn idle() -> Self {
        Self::default()
    }
}

/// Platform-specific media session readers implement this trait. Keeping
/// this boundary here is what lets Windows and macOS ship completely
/// different implementations behind a single call site in `commands/media.rs`.
pub trait MediaSessionProvider: Send + Sync {
    /// Returns the current OS-level "now playing" state, already filtered
    /// so that only a Spotify-sourced session comes back as `is_playing: true`.
    /// A non-Spotify session, or nothing playing at all, both return
    /// `Ok(NowPlaying::idle())` — that's a valid state, not an error.
    fn get_now_playing(&self) -> Result<NowPlaying, MediaSessionError>;
}

#[derive(Debug, thiserror::Error)]
pub enum MediaSessionError {
    #[error("OS media session API unavailable: {0}")]
    Unavailable(String),
    #[error("permission denied reading media session")]
    PermissionDenied,
}

/// Pure, platform-independent filter — deliberately extracted from both
/// platform modules so it's unit-testable without any real OS call.
/// Windows reports an AUMID like `SpotifyAB.SpotifyMusic_...!Spotify`;
/// macOS reports a bundle ID like `com.spotify.client`. Both contain
/// "spotify" case-insensitively, so one check covers both.
pub fn is_spotify_source(source_id: &str) -> bool {
    source_id.to_lowercase().contains("spotify")
}

/// Returns the correct provider for the current OS at compile time.
pub fn get_provider() -> Box<dyn MediaSessionProvider> {
    #[cfg(target_os = "windows")]
    {
        Box::new(super::windows::WindowsMediaProvider::new())
    }
    #[cfg(target_os = "macos")]
    {
        Box::new(super::macos::MacOsMediaProvider::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_windows_spotify_aumid() {
        assert!(is_spotify_source("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"));
    }

    #[test]
    fn recognizes_macos_spotify_bundle_id() {
        assert!(is_spotify_source("com.spotify.client"));
    }

    #[test]
    fn rejects_non_spotify_sources() {
        assert!(!is_spotify_source("com.apple.Music"));
        assert!(!is_spotify_source("com.google.Chrome"));
        assert!(!is_spotify_source(""));
    }

    #[test]
    fn idle_has_no_track_data() {
        let idle = NowPlaying::idle();
        assert!(!idle.is_playing);
        assert!(idle.artist.is_none());
        assert!(idle.title.is_none());
        assert!(idle.album.is_none());
        assert!(idle.artwork_url.is_none());
        assert!(idle.source_app.is_none());
    }
}
