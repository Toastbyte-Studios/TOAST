import { SQLiteDatabase, SQLiteStatic } from '../types/database-types';

export type BookmarkItem = {
  id: string;
  title: string;
  category?: string;
  createdAt?: number;
};

let SQLite: SQLiteStatic | null = null;
try {
  SQLite = require('react-native-sqlite-storage');
} catch {
  // intentionally ignored: react-native-sqlite-storage is a native module that
  // may be unavailable in test/non-native environments
}

let db: SQLiteDatabase | null = null;

/**
 * Initializes the bookmarks SQLite database if it has not already been initialized.
 *
 * - Enables promise-based API for SQLite if available.
 * - Opens (or creates) a database named 'bookmarks.db' in the default location.
 * - Creates a 'bookmarks' table if it does not already exist, with columns:
 *   - `id`: Primary key, text, not null.
 *   - `title`: Text, not null.
 *   - `category`: Text, nullable.
 *   - `createdAt`: Integer, not null (timestamp).
 * - Handles and logs any errors during initialization.
 *
 * @returns {Promise<void>} A promise that resolves when the database is initialized.
 */
async function initDb(): Promise<void> {
  if (db || !SQLite) return;
  try {
    SQLite.enablePromise?.(true);
    db = await SQLite.openDatabase({
      name: 'bookmarks.db',
      location: 'default',
    });
    await db.executeSql(
      'CREATE TABLE IF NOT EXISTS bookmarks (' +
        'id TEXT PRIMARY KEY NOT NULL,' +
        'title TEXT NOT NULL,' +
        'category TEXT,' +
        'createdAt INTEGER NOT NULL' +
        ')',
    );
  } catch (e) {
    console.error('Failed to init bookmarks db', e);
    db = null;
  }
}

/**
 * Retrieves all bookmarks from the database, ordered by creation date in descending order.
 *
 * @returns {Promise<BookmarkItem[]>} A promise that resolves to an array of `BookmarkItem` objects.
 * If the database is not initialized or an error occurs, an empty array is returned.
 *
 * @throws No explicit errors are thrown; errors are logged and an empty array is returned on failure.
 */
export async function getBookmarks(): Promise<BookmarkItem[]> {
  await initDb();
  if (!db) return [];
  try {
    const res = await db.executeSql(
      'SELECT id, title, category, createdAt FROM bookmarks ORDER BY createdAt DESC',
    );
    const rows = res[0].rows;
    const list: BookmarkItem[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows.item(i);
      list.push({
        id: r.id as string,
        title: r.title as string,
        category: (r.category as string | undefined) ?? undefined,
        createdAt: r.createdAt as number,
      });
    }
    return list;
  } catch (e) {
    console.error('Failed to get bookmarks', e);
    return [];
  }
}

/**
 * Checks if a bookmark with the specified ID exists in the database.
 *
 * @param id - The unique identifier of the bookmark to check.
 * @returns A promise that resolves to `true` if the bookmark exists, or `false` otherwise.
 *
 * @throws Will log an error to the console if the database query fails.
 */
export async function isBookmarked(id: string): Promise<boolean> {
  await initDb();
  if (!db) return false;
  try {
    const res = await db.executeSql('SELECT id FROM bookmarks WHERE id = ?', [
      id,
    ]);
    return res[0].rows.length > 0;
  } catch (e) {
    console.error('Failed to check if bookmarked', e);
    return false;
  }
}

/**
 * Adds a new bookmark to the database.
 *
 * Initializes the database connection if necessary, then attempts to insert the provided
 * bookmark item into the `bookmarks` table. If a bookmark with the same `id` already exists,
 * the insertion is ignored. The `createdAt` timestamp is set to the current time if not provided.
 *
 * @param item - The bookmark item to add, containing at least an `id` and `title`.
 * @returns A promise that resolves when the operation is complete.
 * @throws Logs an error to the console if the insertion fails.
 */
export async function addBookmark(item: BookmarkItem): Promise<void> {
  await initDb();
  if (!db) return;
  const now = Date.now();
  try {
    await db.executeSql(
      'INSERT OR IGNORE INTO bookmarks (id, title, category, createdAt) VALUES (?, ?, ?, ?)',
      [item.id, item.title, item.category ?? null, item.createdAt ?? now],
    );
  } catch (e) {
    console.error('Failed to add bookmark', e);
  }
}

/**
 * Removes a bookmark from the database by its unique identifier.
 *
 * Initializes the database connection if necessary, then attempts to delete
 * the bookmark with the specified `id` from the `bookmarks` table.
 * Logs an error to the console if the operation fails.
 *
 * @param id - The unique identifier of the bookmark to remove.
 * @returns A promise that resolves when the bookmark has been removed.
 */
export async function removeBookmark(id: string): Promise<void> {
  await initDb();
  if (!db) return;
  try {
    await db.executeSql('DELETE FROM bookmarks WHERE id = ?', [id]);
  } catch (e) {
    console.error('Failed to remove bookmark', e);
  }
}

/**
 * Removes all stored bookmark records from the local database.
 *
 * Initializes the database connection if needed, then executes a
 * `DELETE FROM bookmarks` statement to clear the table.
 *
 * @remarks
 * If the database is not available (e.g., initialization fails), this function
 * returns without throwing. SQL execution errors are caught and logged.
 *
 * @returns A promise that resolves when the operation completes.
 */
export async function clearBookmarks(): Promise<void> {
  await initDb();
  if (!db) return;
  try {
    await db.executeSql('DELETE FROM bookmarks');
  } catch (e) {
    console.error('Failed to clear bookmarks', e);
  }
}
