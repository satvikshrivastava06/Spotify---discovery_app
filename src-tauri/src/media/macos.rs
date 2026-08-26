#![cfg(target_os = "macos")]

use super::provider::{is_spotify_source, MediaSessionError, MediaSessionProvider, NowPlaying};
use core_foundation::base::{CFTypeRef, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::string::CFString;
use std::ffi::CString;
use std::os::raw::c_void;
use std::sync::mpsc;
use std::time::Duration;

// MediaRemote is a private Apple framework — there is no public header, so
// its symbols are resolved at runtime via dlopen/dlsym instead of linked at
// compile time. This is the same approach used by established open-source
// tools (e.g. nowplaying-cli). It is inherently more fragile than the
// Windows path: Apple can rename or remove these symbols in any macOS
// release without notice — this was flagged as a risk back in Phase 1/2,
// and this module is where that risk concretely lives. A macOS point
// release breaking this is a "patch this module, not the architecture"
// event, per the Disaster Recovery adapter pattern from Phase 2.
//
// Known/undocumented dictionary keys below are reverse-engineered
// community knowledge, not an Apple-published contract — verify against a
// working reference implementation during real-device testing before
// shipping.

type NowPlayingCallback = extern "C" fn(CFTypeRef, *mut c_void);
type MrGetNowPlayingInfoFn =
    unsafe extern "C" fn(queue: *mut c_void, callback: NowPlayingCallback, context: *mut c_void);

pub struct MacOsMediaProvider {
    handle: *mut c_void,
}

// SAFETY: `handle` is an opaque dlopen handle only ever read (never
// mutated) from within this struct's own methods; there's no shared
// mutable state that would make cross-thread access unsound.
unsafe impl Send for MacOsMediaProvider {}
unsafe impl Sync for MacOsMediaProvider {}

impl MacOsMediaProvider {
    pub fn new() -> Self {
        let path = "/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote\0";
        let handle = unsafe { libc::dlopen(path.as_ptr() as *const _, libc::RTLD_LAZY) };
        if handle.is_null() {
            log::warn!("MediaRemote.framework failed to load — macOS now-playing detection will report idle");
        }
        Self { handle }
    }

    fn get_symbol(&self, name: &str) -> Option<*mut c_void> {
        if self.handle.is_null() {
            return None;
        }
        let cname = CString::new(name).ok()?;
        let sym = unsafe { libc::dlsym(self.handle, cname.as_ptr()) };
        if sym.is_null() {
            None
        } else {
            Some(sym)
        }
    }
}

extern "C" fn now_playing_callback(info: CFTypeRef, context: *mut c_void) {
    // SAFETY: `context` was created from `Box::into_raw` in
    // `get_now_playing` just before this callback was registered, and this
    // is the only place it's ever reconstituted.
    let sender = unsafe { Box::from_raw(context as *mut mpsc::Sender<Option<NowPlaying>>) };
    if info.is_null() {
        let _ = sender.send(None);
        return;
    }
    // SAFETY: MediaRemote hands back a CFDictionaryRef per its documented
    // (if unofficial) callback contract.
    let dict: CFDictionary = unsafe { TCFType::wrap_under_get_rule(info as _) };
    let _ = sender.send(parse_now_playing_dict(&dict));
}

fn parse_now_playing_dict(dict: &CFDictionary) -> Option<NowPlaying> {
    let title = cf_string_value(dict, "kMRMediaRemoteNowPlayingInfoTitle")?;
    let artist = cf_string_value(dict, "kMRMediaRemoteNowPlayingInfoArtist");
    let album = cf_string_value(dict, "kMRMediaRemoteNowPlayingInfoAlbum");
    let bundle_id =
        cf_string_value(dict, "kMRMediaRemoteNowPlayingInfoAppBundleID").unwrap_or_default();

    Some(NowPlaying {
        is_playing: true,
        artist,
        title: Some(title),
        album,
        artwork_url: None, // deferred — see the matching note in windows.rs
        source_app: Some(bundle_id),
    })
}

fn cf_string_value(dict: &CFDictionary, key: &str) -> Option<String> {
    let cf_key = CFString::new(key);
    dict.find(cf_key.as_concrete_TypeRef() as *const c_void)
        .map(|value_ptr| {
            // SAFETY: every value under these known string keys in the
            // MediaRemote now-playing dictionary is itself a CFString.
            let cf_val: CFString = unsafe { TCFType::wrap_under_get_rule(*value_ptr as _) };
            cf_val.to_string()
        })
}

impl MediaSessionProvider for MacOsMediaProvider {
    fn get_now_playing(&self) -> Result<NowPlaying, MediaSessionError> {
        let symbol = self.get_symbol("MRMediaRemoteGetNowPlayingInfo").ok_or_else(|| {
            MediaSessionError::Unavailable(
                "MRMediaRemoteGetNowPlayingInfo symbol not found — macOS may have changed \
                 the private framework layout"
                    .into(),
            )
        })?;
        // SAFETY: the symbol was just resolved from the loaded framework
        // and its signature matches Apple's (undocumented) declaration.
        let get_info: MrGetNowPlayingInfoFn = unsafe { std::mem::transmute(symbol) };

        let (tx, rx) = mpsc::channel::<Option<NowPlaying>>();
        let boxed_tx = Box::into_raw(Box::new(tx)) as *mut c_void;

        unsafe {
            get_info(std::ptr::null_mut(), now_playing_callback, boxed_tx);
        }

        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(Some(now_playing)) => {
                let is_spotify = now_playing
                    .source_app
                    .as_deref()
                    .map(is_spotify_source)
                    .unwrap_or(false);
                Ok(if is_spotify { now_playing } else { NowPlaying::idle() })
            }
            Ok(None) => Ok(NowPlaying::idle()),
            Err(_) => {
                log::warn!("MediaRemote callback timed out after 500ms — reporting idle");
                Ok(NowPlaying::idle())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_well_formed_dictionary() {
        let dict = CFDictionary::from_CFType_pairs(&[
            (
                CFString::new("kMRMediaRemoteNowPlayingInfoTitle"),
                CFString::new("Perfect").as_CFType(),
            ),
            (
                CFString::new("kMRMediaRemoteNowPlayingInfoArtist"),
                CFString::new("Ed Sheeran").as_CFType(),
            ),
            (
                CFString::new("kMRMediaRemoteNowPlayingInfoAppBundleID"),
                CFString::new("com.spotify.client").as_CFType(),
            ),
        ]);
        let result = parse_now_playing_dict(&dict).expect("should parse");
        assert_eq!(result.title.as_deref(), Some("Perfect"));
        assert_eq!(result.artist.as_deref(), Some("Ed Sheeran"));
        assert_eq!(result.source_app.as_deref(), Some("com.spotify.client"));
    }

    #[test]
    fn missing_title_key_returns_none() {
        let dict = CFDictionary::from_CFType_pairs(&[(
            CFString::new("kMRMediaRemoteNowPlayingInfoArtist"),
            CFString::new("Ed Sheeran").as_CFType(),
        )]);
        assert!(parse_now_playing_dict(&dict).is_none());
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// Requires a real macOS session with Spotify actively playing. Not run
    /// in CI — see Phase 6 testing notes. Run manually with:
    ///   cargo test --package app -- --ignored get_now_playing_live
    #[test]
    #[ignore]
    fn get_now_playing_live() {
        let provider = MacOsMediaProvider::new();
        let result = provider.get_now_playing().expect("provider call failed");
        println!("{result:#?}");
    }
}
