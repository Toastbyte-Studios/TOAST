/**
 * @format
 * Unit tests for the versioned SQLite migration runner.
 */

import { runMigrations, type Migration } from '../src/utils/dbMigrations'
import type { SQLiteDatabase } from '../src/types/database-types'

// ---------------------------------------------------------------------------
// Minimal in-memory SQLite-like database for testing
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock SQLiteDatabase that tracks executed SQL statements
 * and simulates PRAGMA user_version with a mutable integer.
 *
 * Supports:
 *   - PRAGMA user_version  → returns the current version
 *   - PRAGMA user_version = N  → sets the current version
 *   - BEGIN TRANSACTION / COMMIT / ROLLBACK  → tracked but not deeply simulated
 *   - Any other statement → recorded for inspection; can be made to throw via
 *     `failOnStatement`
 */
function createMockDb(options?: {
  initialVersion?: number
  /** A partial SQL string; any statement that includes this substring will throw. */
  failOnStatement?: string
}): {
  db: SQLiteDatabase
  executedSql: string[]
  getVersion: () => number
} {
  let userVersion = options?.initialVersion ?? 0
  const executedSql: string[] = []
  const failOn = options?.failOnStatement

  const db: SQLiteDatabase = {
    async executeSql(sql: string) {
      executedSql.push(sql)

      // Simulate a configurable failure
      if (failOn && sql.includes(failOn)) {
        throw new Error(`Simulated failure: ${sql}`)
      }

      // Handle PRAGMA user_version = N
      const setMatch = sql.match(/PRAGMA\s+user_version\s*=\s*(\d+)/i)
      if (setMatch) {
        userVersion = parseInt(setMatch[1], 10)
        return [{ rows: { length: 0, item: () => null } }]
      }

      // Handle PRAGMA user_version (read)
      if (/^\s*PRAGMA\s+user_version\s*$/i.test(sql)) {
        return [
          {
            rows: {
              length: 1,
              item: (_i: number) => ({ user_version: userVersion }),
            },
          },
        ]
      }

      return [{ rows: { length: 0, item: () => null } }]
    },
  }

  return { db, executedSql, getVersion: () => userVersion }
}

// ---------------------------------------------------------------------------
// Test migrations
// ---------------------------------------------------------------------------

const MIGRATION_V1: Migration = {
  version: 1,
  statements: ['CREATE TABLE foo (id INTEGER PRIMARY KEY)'],
}

const MIGRATION_V2: Migration = {
  version: 2,
  statements: ['ALTER TABLE foo ADD COLUMN name TEXT'],
}

const MIGRATION_V3: Migration = {
  version: 3,
  statements: [
    'ALTER TABLE foo ADD COLUMN age INTEGER',
    'CREATE INDEX idx_foo_age ON foo (age)',
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runMigrations', () => {
  describe('fresh install (user_version = 0)', () => {
    it('runs all migrations and advances user_version', async () => {
      const { db, getVersion } = createMockDb()
      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2])
      expect(getVersion()).toBe(2)
    })

    it('executes each migration statement', async () => {
      const { db, executedSql } = createMockDb()
      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2])
      expect(executedSql).toContain(MIGRATION_V1.statements[0])
      expect(executedSql).toContain(MIGRATION_V2.statements[0])
    })

    it('wraps each migration in a transaction', async () => {
      const { db, executedSql } = createMockDb()
      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2])

      // Each migration should produce: BEGIN TRANSACTION … COMMIT
      const begins = executedSql.filter((s) => s === 'BEGIN TRANSACTION')
      const commits = executedSql.filter((s) => s === 'COMMIT')
      expect(begins).toHaveLength(2)
      expect(commits).toHaveLength(2)
    })
  })

  describe('sequential upgrade', () => {
    it('skips migrations already applied', async () => {
      const { db, executedSql, getVersion } = createMockDb({
        initialVersion: 1,
      })
      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2, MIGRATION_V3])

      // Only V2 and V3 should run
      expect(getVersion()).toBe(3)
      expect(executedSql).not.toContain(MIGRATION_V1.statements[0])
      expect(executedSql).toContain(MIGRATION_V2.statements[0])
      expect(executedSql).toContain(MIGRATION_V3.statements[0])
    })

    it('does nothing when already at the latest version', async () => {
      const { db, executedSql, getVersion } = createMockDb({
        initialVersion: 3,
      })
      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2, MIGRATION_V3])

      expect(getVersion()).toBe(3)
      // Only the initial PRAGMA user_version read should appear
      expect(executedSql).toEqual(['PRAGMA user_version'])
    })

    it('applies migrations in version order regardless of array order', async () => {
      const { db, executedSql, getVersion } = createMockDb()
      // Deliberately supply out of order
      await runMigrations(db, [MIGRATION_V3, MIGRATION_V1, MIGRATION_V2])

      expect(getVersion()).toBe(3)
      // All three statements should appear in version order
      const stmtIndices = [
        MIGRATION_V1.statements[0],
        MIGRATION_V2.statements[0],
        MIGRATION_V3.statements[0],
      ].map((s) => executedSql.indexOf(s))
      expect(stmtIndices[0]).toBeLessThan(stmtIndices[1])
      expect(stmtIndices[1]).toBeLessThan(stmtIndices[2])
    })
  })

  describe('mid-migration failure → rollback', () => {
    it('rolls back the failing migration and re-throws the error', async () => {
      const { db, executedSql, getVersion } = createMockDb({
        failOnStatement: 'ALTER TABLE foo ADD COLUMN name',
      })

      await expect(
        runMigrations(db, [MIGRATION_V1, MIGRATION_V2]),
      ).rejects.toThrow('Simulated failure')

      // A ROLLBACK must appear after the failure
      expect(executedSql).toContain('ROLLBACK')
    })

    it('does not advance user_version for the failed migration', async () => {
      const { db, getVersion } = createMockDb({
        failOnStatement: 'ALTER TABLE foo ADD COLUMN name',
      })

      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2]).catch(() => {})

      // V1 succeeded, V2 failed — version should remain at 1
      expect(getVersion()).toBe(1)
    })

    it('does not roll back migrations that already committed', async () => {
      const { db, executedSql, getVersion } = createMockDb({
        failOnStatement: 'ALTER TABLE foo ADD COLUMN name',
      })

      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2]).catch(() => {})

      // V1 committed, V2 rolled back
      const begins = executedSql.filter((s) => s === 'BEGIN TRANSACTION')
      const commits = executedSql.filter((s) => s === 'COMMIT')
      const rollbacks = executedSql.filter((s) => s === 'ROLLBACK')
      expect(begins).toHaveLength(2) // one per migration attempted
      expect(commits).toHaveLength(1) // only V1
      expect(rollbacks).toHaveLength(1) // only V2
    })

    it('still runs subsequent migrations after a partial failure if called again', async () => {
      // Simulate a retry: first call fails on V2, version stays at 1.
      // Second call (with the failure removed) finishes V2 and V3.
      let shouldFail = true
      let version = 0
      const executedSql: string[] = []

      const db: SQLiteDatabase = {
        async executeSql(sql: string) {
          executedSql.push(sql)

          if (
            shouldFail &&
            sql.includes('ALTER TABLE foo ADD COLUMN name TEXT')
          ) {
            throw new Error('transient error')
          }

          const setMatch = sql.match(/PRAGMA\s+user_version\s*=\s*(\d+)/i)
          if (setMatch) {
            version = parseInt(setMatch[1], 10)
            return [{ rows: { length: 0, item: () => null } }]
          }
          if (/^\s*PRAGMA\s+user_version\s*$/i.test(sql)) {
            return [
              { rows: { length: 1, item: () => ({ user_version: version }) } },
            ]
          }
          return [{ rows: { length: 0, item: () => null } }]
        },
      }

      await runMigrations(db, [
        MIGRATION_V1,
        MIGRATION_V2,
        MIGRATION_V3,
      ]).catch(() => {})
      expect(version).toBe(1)

      shouldFail = false
      await runMigrations(db, [MIGRATION_V1, MIGRATION_V2, MIGRATION_V3])
      expect(version).toBe(3)
    })
  })

  describe('multi-statement migrations', () => {
    it('executes all statements in a single migration', async () => {
      const { db, executedSql } = createMockDb()
      await runMigrations(db, [MIGRATION_V3])
      expect(executedSql).toContain(MIGRATION_V3.statements[0])
      expect(executedSql).toContain(MIGRATION_V3.statements[1])
    })
  })
})
