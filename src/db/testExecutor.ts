// Test-only — never imported from production code (nothing in main.tsx or
// lib.rs references this file). Runs against real SQLite in-memory via
// Node's built-in node:sqlite module, so repository tests exercise real
// SQL rather than a mocked query layer that could pass while the actual
// SQL is broken.
//
// Verified against Node 22.22.2 in this project's dev environment — an
// earlier draft of this file used the better-sqlite3 package instead, but
// that requires a native compile step (node-gyp) that isn't guaranteed to
// work in every environment (it failed in a sandboxed one while writing
// this module). node:sqlite ships with Node itself, so there's nothing to
// compile. It's still flagged experimental by Node itself as of this
// version — worth re-checking on a Node upgrade, but there's nothing
// SQLite-specific about the queries these tests run that would be
// affected by that flag changing.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExecuteResult, SqlExecutor } from "./executor";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Same file the real app loads via include_str! in src-tauri/src/lib.rs —
// one schema, two consumers, no chance of the test schema drifting from
// what Phase 4 actually specifies.
const SCHEMA_PATH = join(__dirname, "../../src-tauri/migrations/0001_init.sql");

export function createTestExecutor(): SqlExecutor {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(SCHEMA_PATH, "utf-8"));

  return {
    async execute(query: string, params: unknown[] = []): Promise<ExecuteResult> {
      const result = db.prepare(query).run(...(params as never[]));
      return {
        rowsAffected: Number(result.changes),
        lastInsertId: Number(result.lastInsertRowid),
      };
    },
    async select<T>(query: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(query).all(...(params as never[])) as T[];
    },
  };
}
