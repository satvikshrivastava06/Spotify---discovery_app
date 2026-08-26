pub mod provider;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
mod macos;

pub use provider::{get_provider, MediaSessionError, MediaSessionProvider, NowPlaying};
