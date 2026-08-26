export type ErrorCode =
  | "NETWORK_ERROR"
  | "QUOTA_EXCEEDED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "KEYCHAIN_ERROR"
  | "OS_MEDIA_UNAVAILABLE"
  | "UNKNOWN";

export type CommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

export function ok<T>(data: T): CommandResult<T> {
  return { ok: true, data };
}

export function err<T>(code: ErrorCode, message: string): CommandResult<T> {
  return { ok: false, error: { code, message } };
}
