export interface ExecuteResult {
  rowsAffected: number;
  lastInsertId?: number;
}

/**
 * Thin abstraction over SQL access. Production code uses TauriSqlExecutor
 * (wrapping @tauri-apps/plugin-sql); tests use createTestExecutor()
 * (backed by real SQLite via better-sqlite3, loading the same migration
 * file as the real app). Repositories never know which one they're
 * talking to.
 */
export interface SqlExecutor {
  execute(query: string, params?: unknown[]): Promise<ExecuteResult>;
  select<T>(query: string, params?: unknown[]): Promise<T[]>;
}
