import { SQLiteDatabase } from '../types/database-types'

/**
 * A single versioned migration.
 * `version` is a positive integer; migrations are applied in ascending order.
 * `statements` are executed sequentially inside a single transaction.
 */
export interface Migration {
  version: number
  statements: string[]
}

/**
 * Runs pending migrations against `db`.
 *
 * Schema version is tracked with SQLite's built-in `PRAGMA user_version`.
 * Each migration is applied inside its own transaction; if any statement
 * fails the transaction is rolled back and the error is re-thrown so the
 * caller can handle it explicitly — no errors are swallowed.
 *
 * @param db         An open SQLiteDatabase instance.
 * @param migrations An array of migrations; order in the array does not matter —
 *                   they are sorted by `version` and only versions greater than
 *                   the current `user_version` are executed.
 */
export async function runMigrations(
  db: SQLiteDatabase,
  migrations: Migration[],
): Promise<void> {
  const versionResult = await db.executeSql('PRAGMA user_version')
  const currentVersion: number =
    (versionResult[0]?.rows?.item(0)?.user_version as number | undefined) ?? 0

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    await db.executeSql('BEGIN TRANSACTION')
    try {
      for (const statement of migration.statements) {
        await db.executeSql(statement)
      }
      // PRAGMA user_version is transactional in SQLite — it is rolled back
      // automatically if the transaction aborts.
      await db.executeSql(`PRAGMA user_version = ${migration.version}`)
      await db.executeSql('COMMIT')
    } catch (error) {
      await db.executeSql('ROLLBACK')
      throw error
    }
  }
}
