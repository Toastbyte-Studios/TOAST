import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import { SQLiteDatabase } from '../types/database-types';

/**
 * Represents a single saved waypoint.
 */
export interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string; // ISO date string
}

/**
 * Store for managing waypoints with SQLite persistence.
 * Waypoints are saved to toast.db and persist across app restarts.
 */
export class WaypointStore {
  waypoints: Waypoint[] = [];
  activeWaypointId: string | null = null;
  waypointDb: SQLiteDatabase | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * The currently active waypoint, or null if none is selected.
   */
  get activeWaypoint(): Waypoint | null {
    if (!this.activeWaypointId) {
      return null;
    }
    return this.waypoints.find((w) => w.id === this.activeWaypointId) ?? null;
  }

  /**
   * The next default waypoint name, e.g. "Waypoint 1", "Waypoint 2".
   */
  get nextWaypointName(): string {
    return `Waypoint ${this.waypoints.length + 1}`;
  }

  /**
   * Initialises the waypoints table in the shared toast.db and loads saved waypoints.
   * Accepts the same SQLiteDatabase instance opened by CoreStore so all data
   * lives in a single file.
   */
  async initDatabase(db: SQLiteDatabase): Promise<void> {
    this.waypointDb = db;
    try {
      await this.createTable();
      await this.loadWaypoints();
    } catch (e) {
      console.warn('WaypointStore: failed to init database', e);
    }
  }

  private async createTable(): Promise<void> {
    if (!this.waypointDb) {
      return;
    }
    await this.waypointDb.executeSql(
      'CREATE TABLE IF NOT EXISTS waypoints (' +
        'id TEXT PRIMARY KEY, ' +
        'name TEXT NOT NULL, ' +
        'latitude REAL NOT NULL, ' +
        'longitude REAL NOT NULL, ' +
        'createdAt TEXT NOT NULL' +
        ')',
    );
  }

  private async loadWaypoints(): Promise<void> {
    if (!this.waypointDb) {
      return;
    }
    const [results] = await this.waypointDb.executeSql(
      'SELECT id, name, latitude, longitude, createdAt FROM waypoints ORDER BY createdAt ASC',
    );
    const loaded: Waypoint[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      loaded.push({
        id: row.id,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        createdAt: row.createdAt,
      });
    }
    runInAction(() => {
      this.waypoints = loaded;
    });
  }

  /**
   * Adds a new waypoint, persists it to SQLite, and returns the created waypoint.
   */
  async addWaypoint(
    name: string,
    latitude: number,
    longitude: number,
  ): Promise<Waypoint> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Waypoint name cannot be empty');
    }
    const waypoint: Waypoint = {
      id: uuidv4(),
      name: trimmed,
      latitude,
      longitude,
      createdAt: new Date().toISOString(),
    };
    if (this.waypointDb) {
      await this.waypointDb.executeSql(
        'INSERT INTO waypoints (id, name, latitude, longitude, createdAt) VALUES (?, ?, ?, ?, ?)',
        [
          waypoint.id,
          waypoint.name,
          waypoint.latitude,
          waypoint.longitude,
          waypoint.createdAt,
        ],
      );
    }
    runInAction(() => {
      this.waypoints.push(waypoint);
    });
    return waypoint;
  }

  /**
   * Replaces or merges a list of waypoints imported from a backup.
   * In replace mode all existing waypoints are removed first.
   * In merge mode only waypoints whose IDs do not already exist are inserted.
   */
  async importData(
    waypoints: Waypoint[],
    mode: 'replace' | 'merge',
  ): Promise<void> {
    if (this.waypointDb) {
      try {
        await this.waypointDb.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.waypointDb.executeSql('DELETE FROM waypoints');
        }
        const sql =
          mode === 'replace'
            ? 'INSERT OR REPLACE INTO waypoints (id, name, latitude, longitude, createdAt) VALUES (?, ?, ?, ?, ?)'
            : 'INSERT OR IGNORE INTO waypoints (id, name, latitude, longitude, createdAt) VALUES (?, ?, ?, ?, ?)';
        for (const w of waypoints) {
          await this.waypointDb.executeSql(sql, [
            w.id,
            w.name,
            w.latitude,
            w.longitude,
            w.createdAt,
          ]);
        }
        await this.waypointDb.executeSql('COMMIT');
      } catch (error) {
        await this.waypointDb.executeSql('ROLLBACK');
        throw error;
      }
    }
    runInAction(() => {
      if (mode === 'replace') {
        this.waypoints = waypoints;
        this.activeWaypointId = null;
      } else {
        const existingIds = new Set(this.waypoints.map((w) => w.id));
        const incoming = waypoints.filter((w) => !existingIds.has(w.id));
        this.waypoints = [...this.waypoints, ...incoming];
      }
    });
  }

  /**
   * Deletes a waypoint by ID from both memory and SQLite.
   * If the deleted waypoint was active, clears the active selection.
   */
  async deleteWaypoint(id: string): Promise<void> {
    if (this.waypointDb) {
      await this.waypointDb.executeSql('DELETE FROM waypoints WHERE id = ?', [
        id,
      ]);
    }
    runInAction(() => {
      this.waypoints = this.waypoints.filter((w) => w.id !== id);
      if (this.activeWaypointId === id) {
        this.activeWaypointId = null;
      }
    });
  }

  /**
   * Sets the active waypoint by ID, or clears it when null is passed.
   */
  setActiveWaypoint(id: string | null): void {
    this.activeWaypointId = id;
  }

  /**
   * Clears the active waypoint selection.
   */
  clearActiveWaypoint(): void {
    this.activeWaypointId = null;
  }

  dispose(): void {
    this.waypointDb = null;
  }
}
