import Database from "@tauri-apps/plugin-sql";
import type { ExecuteResult, SqlExecutor } from "./executor";

export class TauriSqlExecutor implements SqlExecutor {
  private db: Database | null = null;

  private async connection(): Promise<Database> {
    if (!this.db) {
      this.db = await Database.load("sqlite:cache.db");
      // SQLite disables foreign-key enforcement per connection by default —
      // must be set explicitly every time a connection opens (Phase 4 note).
      await this.db.execute("PRAGMA foreign_keys = ON");
    }
    return this.db;
  }

  async execute(query: string, params: unknown[] = []): Promise<ExecuteResult> {
    const db = await this.connection();
    const result = await db.execute(query, params);
    return { rowsAffected: result.rowsAffected, lastInsertId: result.lastInsertId };
  }

  async select<T>(query: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.connection();
    return db.select<T[]>(query, params);
  }
}
