/**
 * Versioned migration runner for SQLite databases.
 *
 * Migrations are stored as ordered arrays of `Migration` objects.
 * Each migration is executed inside a transaction; on failure the
 * transaction is rolled back and the error is surfaced to the caller
 * instead of being silently swallowed.
 *
 * Applied migrations are tracked in a `schema_migrations` table that is
 * shared by all namespaces inside the same database file.  A namespace
 * string (e.g. `'notes'`, `'inventory'`) scopes the IDs so that each
 * store can independently version its own tables starting from id 1.
 */

import type { SQLiteDatabase } from '../types/database-types';

// ─── Public types ────────────────────────────────────────────────────────────

export interface Migration {
  /** Must be a positive integer unique within the namespace. */
  readonly id: number;
  /** Human-readable description shown in error messages and logs. */
  readonly description: string;
  /**
   * Executes the migration against the given database handle.
   * The runner wraps this call in a transaction; any thrown error
   * causes a rollback.  Do **not** issue BEGIN/COMMIT/ROLLBACK inside
   * this function.
   */
  readonly run: (db: SQLiteDatabase) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the set of column names that currently exist in `tableName`.
 * Returns an empty set when the table does not exist.
 */
export async function getTableColumns(
  db: SQLiteDatabase,
  tableName: string,
): Promise<Set<string>> {
  const [result] = await db.executeSql(`PRAGMA table_info(${tableName})`);
  const columns = new Set<string>();
  for (let i = 0; i < result.rows.length; i++) {
    columns.add(result.rows.item(i).name as string);
  }
  return columns;
}

/**
 * Returns the raw `CREATE TABLE` DDL for `tableName` from `sqlite_master`,
 * or `null` when the table does not exist.
 */
export async function getTableDDL(
  db: SQLiteDatabase,
  tableName: string,
): Promise<string | null> {
  const [result] = await db.executeSql(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
    [tableName],
  );
  if (result.rows.length === 0) return null;
  return result.rows.item(0).sql as string;
}

// ─── Migration runner ─────────────────────────────────────────────────────────

/**
 * Runs all pending migrations for the given `namespace` against `db`.
 *
 * @param db         - An open SQLiteDatabase handle.
 * @param namespace  - Logical grouping for the migration IDs (e.g. `'notes'`).
 * @param migrations - Ordered list of migrations to apply.
 *
 * @throws If any migration fails the transaction is rolled back and the
 *         original error is re-thrown so the caller can handle it.
 */
export async function runMigrations(
  db: SQLiteDatabase,
  namespace: string,
  migrations: Migration[],
): Promise<void> {
  // Ensure the tracking table exists.
  await db.executeSql(
    'CREATE TABLE IF NOT EXISTS schema_migrations (' +
      'namespace TEXT NOT NULL,' +
      'id        INTEGER NOT NULL,' +
      'PRIMARY KEY (namespace, id)' +
      ')',
  );

  // Fetch already-applied migration IDs for this namespace.
  const [result] = await db.executeSql(
    'SELECT id FROM schema_migrations WHERE namespace = ?',
    [namespace],
  );
  const applied = new Set<number>();
  for (let i = 0; i < result.rows.length; i++) {
    applied.add(result.rows.item(i).id as number);
  }

  // Sort by id to guarantee execution order regardless of array ordering.
  const sorted = [...migrations].sort((a, b) => a.id - b.id);

  for (const migration of sorted) {
    if (applied.has(migration.id)) continue;

    await db.executeSql('BEGIN TRANSACTION');
    try {
      await migration.run(db);
      await db.executeSql(
        'INSERT INTO schema_migrations (namespace, id) VALUES (?, ?)',
        [namespace, migration.id],
      );
      await db.executeSql('COMMIT');
    } catch (error) {
      await db.executeSql('ROLLBACK');
      throw new Error(
        `Migration "${namespace}/${migration.id} – ${migration.description}" failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}
