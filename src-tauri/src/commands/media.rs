use crate::media::{get_provider, NowPlaying};
use serde::Serialize;

/// The concrete Rust shape of the Phase 5 `CommandResult<T>` TypeScript
/// contract. A true `{ ok: true, data } | { ok: false, error }` tagged
/// union is awkward to derive with serde on a boolean tag, so this uses a
/// flat struct with optional fields instead — `ok` still tells the
/// frontend exactly which of `data`/`error` is populated.
#[derive(Serialize)]
pub struct CommandResult<T: Serialize> {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<CommandError>,
}

impl<T: Serialize> CommandResult<T> {
    fn ok(data: T) -> Self {
        Self { ok: true, data: Some(data), error: None }
    }

    fn err(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(CommandError { code, message: message.into() }),
        }
    }
}

#[derive(Serialize)]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
}

/// Matches the `ErrorCode` union from the Phase 5 TypeScript contract.
#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    OsMediaUnavailable,
}

#[tauri::command]
pub fn get_now_playing() -> CommandResult<NowPlaying> {
    let provider = get_provider();
    match provider.get_now_playing() {
        Ok(now_playing) => CommandResult::ok(now_playing),
        Err(e) => {
            log::error!("get_now_playing failed: {e}");
            CommandResult::err(ErrorCode::OsMediaUnavailable, e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::NowPlaying;

    #[test]
    fn ok_result_serializes_with_data_and_no_error_field() {
        let result = CommandResult::ok(NowPlaying::idle());
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["ok"], true);
        assert!(json.get("data").is_some());
        assert!(json.get("error").is_none());
    }

    #[test]
    fn err_result_serializes_with_error_and_no_data_field() {
        let result: CommandResult<NowPlaying> =
            CommandResult::err(ErrorCode::OsMediaUnavailable, "test failure");
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["ok"], false);
        assert!(json.get("data").is_none());
        assert_eq!(json["error"]["code"], "OS_MEDIA_UNAVAILABLE");
        assert_eq!(json["error"]["message"], "test failure");
    }
}
