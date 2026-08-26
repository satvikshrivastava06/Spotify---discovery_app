import type { SqlExecutor } from "./executor";
import { type CommandResult, err, ok } from "./result";

/**
 * Non-secret preferences only (theme, cache TTL, telemetry opt-in, etc.).
 * API keys never touch this table or this repository — those go through
 * the Stronghold-backed module planned next (Phase 6 correction #1). If a
 * future change ever routes a key through `set()`, that's a regression
 * worth catching in review, not something this layer guards against
 * automatically — worth flagging plainly rather than pretending it's
 * enforced in code.
 */
export class SettingsRepository {
  constructor(private db: SqlExecutor) {}

  async get(key: string): Promise<CommandResult<string | null>> {
    try {
      const rows = await this.db.select<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        [key],
      );
      return ok(rows[0]?.value ?? null);
    } catch (e) {
      return err("UNKNOWN", `settings.get failed: ${String(e)}`);
    }
  }

  async getAll(): Promise<CommandResult<Record<string, string>>> {
    try {
      const rows = await this.db.select<{ key: string; value: string }>(
        "SELECT key, value FROM settings",
      );
      const result: Record<string, string> = {};
      for (const row of rows) result[row.key] = row.value;
      return ok(result);
    } catch (e) {
      return err("UNKNOWN", `settings.getAll failed: ${String(e)}`);
    }
  }

  async set(key: string, value: string): Promise<CommandResult<void>> {
    try {
      await this.db.execute(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, new Date().toISOString()],
      );
      return ok(undefined);
    } catch (e) {
      return err("UNKNOWN", `settings.set failed: ${String(e)}`);
    }
  }
}
