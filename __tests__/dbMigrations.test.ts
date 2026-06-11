/**
 * @format
 * Unit tests for the versioned migration runner (src/utils/dbMigrations.ts).
 *
 * Tests cover:
 *  - Fresh install  : all migrations run in id order
 *  - Sequential upgrade : previously applied migrations are skipped
 *  - Mid-migration failure : the transaction is rolled back and the error surfaces
 *  - getTableColumns helper
 *  - getTableDDL helper
 */

import {
  getTableColumns,
  getTableDDL,
  Migration,
  runMigrations,
} from '../src/utils/dbMigrations';
import type { SQLiteDatabase } from '../src/types/database-types';

// ─── Minimal in-memory SQLite simulation ─────────────────────────────────────

/**
 * Very small in-memory "database" that supports the subset of SQLite
 * semantics exercised by the migration runner and its helpers:
 *
 *  - CREATE TABLE IF NOT EXISTS
 *  - INSERT INTO schema_migrations
 *  - SELECT id FROM schema_migrations WHERE namespace = ?
 *  - BEGIN / COMMIT / ROLLBACK
 *  - PRAGMA table_info(<table>)
 *  - SELECT sql FROM sqlite_master WHERE type='table' AND name=?
 */
class InMemoryDb implements SQLiteDatabase {
  /** Map of tableName → array of column-name strings */
  readonly tables: Map<string, string[]> = new Map();
  /** Map of tableName → DDL string (used by sqlite_master queries) */
  readonly tableDDLs: Map<string, string> = new Map();
  /** Rows in schema_migrations: array of { namespace, id } */
  readonly migrations: Array<{ namespace: string; id: number }> = [];
  /** Tracks every SQL statement that was executed (useful for assertions) */
  readonly executedSql: string[] = [];
  /** When set, the NEXT executeSql call for a matching substring throws. */
  failOnSqlContaining: string | null = null;

  private inTransaction = false;
  /** Snapshot for rollback: [tables, tableDDLs, migrations] */
  private snapshot: {
    tables: Map<string, string[]>;
    tableDDLs: Map<string, string>;
    migrations: Array<{ namespace: string; id: number }>;
  } | null = null;

  async executeSql(
    sql: string,
    params: Array<string | number | boolean | null> = [],
  ): Promise<Array<{ rows: { length: number; item(index: number): any } }>> {
    const s = sql.trim();

    // Simulate a forced failure for specific SQL patterns (used in tests).
    if (this.failOnSqlContaining && s.includes(this.failOnSqlContaining)) {
      this.failOnSqlContaining = null; // reset so only one call fails
      throw new Error(`Simulated failure on: ${s}`);
    }

    this.executedSql.push(s);

    // Transaction control
    if (/^BEGIN/i.test(s)) {
      this.inTransaction = true;
      this.snapshot = {
        tables: new Map(
          [...this.tables.entries()].map(([k, v]) => [k, [...v]]),
        ),
        tableDDLs: new Map(this.tableDDLs),
        migrations: [...this.migrations],
      };
      return emptyResult();
    }
    if (/^COMMIT/i.test(s)) {
      this.inTransaction = false;
      this.snapshot = null;
      return emptyResult();
    }
    if (/^ROLLBACK/i.test(s)) {
      if (this.snapshot) {
        this.tables.clear();
        for (const [k, v] of this.snapshot.tables) this.tables.set(k, v);
        this.tableDDLs.clear();
        for (const [k, v] of this.snapshot.tableDDLs) this.tableDDLs.set(k, v);
        this.migrations.length = 0;
        this.migrations.push(...this.snapshot.migrations);
        this.snapshot = null;
      }
      this.inTransaction = false;
      return emptyResult();
    }

    // CREATE TABLE IF NOT EXISTS <name> (...)
    const createMatch = s.match(
      /^CREATE TABLE IF NOT EXISTS (\w+)\s*\((.+)\)$/is,
    );
    if (createMatch) {
      const tableName = createMatch[1];
      if (!this.tables.has(tableName)) {
        // Parse column names from the DDL
        const colDefs = splitTopLevelCommas(createMatch[2])
          .map((c) => c.trim())
          .filter(
            (c) =>
              c.length > 0 &&
              !c.toUpperCase().startsWith('PRIMARY KEY') &&
              !c.toUpperCase().startsWith('FOREIGN KEY'),
          );
        const cols = colDefs
          .map((c) => c.match(/^"?(\w+)"?/)?.[1])
          .filter(Boolean) as string[];
        this.tables.set(tableName, cols);
        this.tableDDLs.set(tableName, sql);
      }
      return emptyResult();
    }

    // ALTER TABLE <name> RENAME TO <newname>
    const renameMatch = s.match(/^ALTER TABLE (\w+) RENAME TO (\w+)$/i);
    if (renameMatch) {
      const from = renameMatch[1];
      const to = renameMatch[2];
      const cols = this.tables.get(from);
      if (cols) {
        this.tables.set(to, cols);
        this.tables.delete(from);
        const ddl = this.tableDDLs.get(from);
        if (ddl) {
          this.tableDDLs.set(to, ddl);
          this.tableDDLs.delete(from);
        }
      }
      return emptyResult();
    }

    // CREATE TABLE <name> (...)  (without IF NOT EXISTS – used in rebuilds)
    const createNoGuardMatch = s.match(/^CREATE TABLE (\w+)\s*\((.+)\)$/is);
    if (createNoGuardMatch) {
      const tableName = createNoGuardMatch[1];
      const colDefs = splitTopLevelCommas(createNoGuardMatch[2])
        .map((c) => c.trim())
        .filter(
          (c) =>
            c.length > 0 &&
            !c.toUpperCase().startsWith('PRIMARY KEY') &&
            !c.toUpperCase().startsWith('FOREIGN KEY'),
        );
      const cols = colDefs
        .map((c) => c.match(/^"?(\w+)"?/)?.[1])
        .filter(Boolean) as string[];
      this.tables.set(tableName, cols);
      this.tableDDLs.set(tableName, sql);
      return emptyResult();
    }

    // ALTER TABLE <name> ADD COLUMN <col> <type>
    const alterMatch = s.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
    if (alterMatch) {
      const tableName = alterMatch[1];
      const colName = alterMatch[2];
      const cols = this.tables.get(tableName) ?? [];
      if (!cols.includes(colName)) cols.push(colName);
      this.tables.set(tableName, cols);
      return emptyResult();
    }

    // DROP TABLE <name>
    const dropMatch = s.match(/^DROP TABLE (\w+)$/i);
    if (dropMatch) {
      this.tables.delete(dropMatch[1]);
      this.tableDDLs.delete(dropMatch[1]);
      return emptyResult();
    }

    // INSERT INTO schema_migrations (namespace, id) VALUES (?, ?)
    if (/^INSERT INTO schema_migrations/i.test(s)) {
      const namespace = params[0] as string;
      const id = params[1] as number;
      this.migrations.push({ namespace, id });
      return emptyResult();
    }

    // SELECT id FROM schema_migrations WHERE namespace = ?
    if (/^SELECT id FROM schema_migrations WHERE namespace/i.test(s)) {
      const namespace = params[0] as string;
      const rows = this.migrations.filter((m) => m.namespace === namespace);
      return [
        {
          rows: {
            length: rows.length,
            item: (i: number) => rows[i],
          },
        },
      ];
    }

    // PRAGMA table_info(<name>)
    const pragmaMatch = s.match(/^PRAGMA table_info\((\w+)\)$/i);
    if (pragmaMatch) {
      const tableName = pragmaMatch[1];
      const cols = this.tables.get(tableName) ?? [];
      return [
        {
          rows: {
            length: cols.length,
            item: (i: number) => ({ name: cols[i] }),
          },
        },
      ];
    }

    // SELECT sql FROM sqlite_master WHERE type='table' AND name=?
    if (/SELECT sql FROM sqlite_master/i.test(s)) {
      const tableName = params[0] as string;
      const ddl = this.tableDDLs.get(tableName);
      if (ddl) {
        return [{ rows: { length: 1, item: () => ({ sql: ddl }) } }];
      }
      return emptyResult();
    }

    // INSERT INTO … (generic – used in rebuild data-copy step)
    if (/^INSERT INTO/i.test(s)) {
      return emptyResult();
    }

    return emptyResult();
  }
}

function emptyResult() {
  return [{ rows: { length: 0, item: () => null } }];
}

/**
 * Splits `s` on commas that are not inside parentheses, so that
 * compound constraint clauses like `PRIMARY KEY (namespace, id)` are
 * treated as a single token instead of being broken at the inner comma.
 */
function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runMigrations', () => {
  let db: InMemoryDb;

  beforeEach(() => {
    db = new InMemoryDb();
  });

  it('creates the schema_migrations table on first run', async () => {
    await runMigrations(db, 'test', []);
    expect(db.tables.has('schema_migrations')).toBe(true);
  });

  it('runs all migrations on a fresh database (in id order)', async () => {
    const executed: number[] = [];
    const migrations: Migration[] = [
      {
        id: 2,
        description: 'second',
        run: async () => {
          executed.push(2);
        },
      },
      {
        id: 1,
        description: 'first',
        run: async () => {
          executed.push(1);
        },
      },
      {
        id: 3,
        description: 'third',
        run: async () => {
          executed.push(3);
        },
      },
    ];

    await runMigrations(db, 'test', migrations);

    expect(executed).toEqual([1, 2, 3]);
    const applied = db.migrations.filter((m) => m.namespace === 'test');
    expect(applied.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('skips already-applied migrations on a subsequent run', async () => {
    const executed: number[] = [];
    const migrations: Migration[] = [
      {
        id: 1,
        description: 'first',
        run: async () => {
          executed.push(1);
        },
      },
      {
        id: 2,
        description: 'second',
        run: async () => {
          executed.push(2);
        },
      },
    ];

    // First run: both execute.
    await runMigrations(db, 'test', migrations);
    executed.length = 0;

    // Second run (same db): neither should execute again.
    await runMigrations(db, 'test', migrations);

    expect(executed).toEqual([]);
  });

  it('runs only new migrations when more are added later (sequential upgrade)', async () => {
    const executed: number[] = [];
    const v1Migrations: Migration[] = [
      {
        id: 1,
        description: 'create table',
        run: async () => {
          executed.push(1);
        },
      },
    ];
    await runMigrations(db, 'test', v1Migrations);
    executed.length = 0;

    const v2Migrations: Migration[] = [
      ...v1Migrations,
      {
        id: 2,
        description: 'add column',
        run: async () => {
          executed.push(2);
        },
      },
    ];
    await runMigrations(db, 'test', v2Migrations);

    expect(executed).toEqual([2]);
  });

  it('rolls back the failed migration and surfaces the error', async () => {
    const migrations: Migration[] = [
      {
        id: 1,
        description: 'good migration',
        run: async (d) => {
          await d.executeSql('CREATE TABLE IF NOT EXISTS t1 (id INTEGER)');
        },
      },
      {
        id: 2,
        description: 'bad migration',
        run: async () => {
          throw new Error('intentional failure');
        },
      },
    ];

    await expect(runMigrations(db, 'test', migrations)).rejects.toThrow(
      /Migration "test\/2.*intentional failure/,
    );

    // Migration 1 should be recorded; migration 2 should not.
    const applied = db.migrations.filter((m) => m.namespace === 'test');
    expect(applied.map((m) => m.id)).toEqual([1]);
  });

  it('namespaces are independent – same id in different namespaces both run', async () => {
    const executed: string[] = [];
    const mA: Migration = {
      id: 1,
      description: 'ns-a migration 1',
      run: async () => {
        executed.push('a:1');
      },
    };
    const mB: Migration = {
      id: 1,
      description: 'ns-b migration 1',
      run: async () => {
        executed.push('b:1');
      },
    };

    await runMigrations(db, 'ns-a', [mA]);
    await runMigrations(db, 'ns-b', [mB]);

    expect(executed).toEqual(['a:1', 'b:1']);
  });

  it('a mid-migration SQL error rolls back partial table creation', async () => {
    // Prime the db to fail on any ALTER TABLE statement during migration 1.
    const migrations: Migration[] = [
      {
        id: 1,
        description: 'partial migration',
        run: async (d) => {
          await d.executeSql(
            'CREATE TABLE IF NOT EXISTS partial_table (id TEXT)',
          );
          // This call will throw.
          db.failOnSqlContaining = 'ALTER TABLE';
          await d.executeSql('ALTER TABLE partial_table ADD COLUMN extra TEXT');
        },
      },
    ];

    await expect(runMigrations(db, 'test', migrations)).rejects.toThrow();

    // The migration must NOT be recorded.
    const applied = db.migrations.filter((m) => m.namespace === 'test');
    expect(applied).toHaveLength(0);

    // The table created inside the failed transaction should be rolled back.
    // (Our in-memory db simulates rollback via the snapshot mechanism.)
    expect(db.tables.has('partial_table')).toBe(false);
  });

  it('throws when a migration id is not a positive integer', async () => {
    const migrations: Migration[] = [
      { id: 0, description: 'zero id', run: async () => {} },
    ];
    await expect(runMigrations(db, 'test', migrations)).rejects.toThrow(
      /positive integer/,
    );
  });

  it('throws when two migrations share the same id within a namespace', async () => {
    const migrations: Migration[] = [
      { id: 1, description: 'first', run: async () => {} },
      { id: 1, description: 'duplicate', run: async () => {} },
    ];
    await expect(runMigrations(db, 'test', migrations)).rejects.toThrow(
      /Duplicate migration id/,
    );
  });
});

// ─── Helper tests ─────────────────────────────────────────────────────────────

describe('getTableColumns', () => {
  let db: InMemoryDb;

  beforeEach(() => {
    db = new InMemoryDb();
  });

  it('returns column names for an existing table', async () => {
    await db.executeSql(
      'CREATE TABLE IF NOT EXISTS things (id TEXT, name TEXT, value INTEGER)',
    );
    const cols = await getTableColumns(db as SQLiteDatabase, 'things');
    expect(cols.has('id')).toBe(true);
    expect(cols.has('name')).toBe(true);
    expect(cols.has('value')).toBe(true);
  });

  it('returns an empty set when the table does not exist', async () => {
    const cols = await getTableColumns(db as SQLiteDatabase, 'nonexistent');
    expect(cols.size).toBe(0);
  });

  it('throws for an unsafe table name (SQL injection guard)', async () => {
    await expect(
      getTableColumns(db as SQLiteDatabase, "bad'; DROP TABLE notes;--"),
    ).rejects.toThrow(/Unsafe SQL identifier/);
  });
});

describe('getTableDDL', () => {
  let db: InMemoryDb;

  beforeEach(() => {
    db = new InMemoryDb();
  });

  it('returns the DDL for an existing table', async () => {
    const ddl =
      "CREATE TABLE IF NOT EXISTS notes (id TEXT, type TEXT CHECK(type IN ('text','voice')))";
    await db.executeSql(ddl);
    const result = await getTableDDL(db as SQLiteDatabase, 'notes');
    expect(result).toBe(ddl);
  });

  it('returns null for a non-existent table', async () => {
    const result = await getTableDDL(db as SQLiteDatabase, 'ghost');
    expect(result).toBeNull();
  });
});
