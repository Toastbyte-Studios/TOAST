import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import { SQLiteDatabase } from '../types/database-types';

/**
 * A single GPS point recorded as part of a track.
 */
export interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number; // Unix ms
}

/**
 * A saved breadcrumb trail with metadata and serialised GPS points.
 */
export interface Track {
  id: string;
  name: string;
  createdAt: string; // ISO date string
  durationSeconds: number;
  distanceMeters: number;
  points: TrackPoint[]; // stored as a JSON blob in SQLite
}

/** Returns a default track name like "Track 2024-06-15 14:30". */
function defaultTrackName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Track ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Store for managing recorded GPS tracks with SQLite persistence.
 * Tracks are saved to toast.db and persist across app restarts.
 */
export class TrackStore {
  tracks: Track[] = [];
  trackDb: SQLiteDatabase | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Initialises the tracks table in the shared toast.db and loads saved tracks.
   * Accepts the same SQLiteDatabase instance opened by CoreStore so all data
   * lives in a single file.
   */
  async initDatabase(db: SQLiteDatabase): Promise<void> {
    this.trackDb = db;
    try {
      await this.createTable();
      await this.loadTracks();
    } catch (e) {
      console.warn('TrackStore: failed to init database', e);
    }
  }

  private async createTable(): Promise<void> {
    if (!this.trackDb) {
      return;
    }
    await this.trackDb.executeSql(
      'CREATE TABLE IF NOT EXISTS tracks (' +
        'id TEXT PRIMARY KEY, ' +
        'name TEXT NOT NULL, ' +
        'createdAt TEXT NOT NULL, ' +
        'durationSeconds REAL NOT NULL, ' +
        'distanceMeters REAL NOT NULL, ' +
        'points TEXT NOT NULL' +
        ')',
    );
  }

  private async loadTracks(): Promise<void> {
    if (!this.trackDb) {
      return;
    }
    const [results] = await this.trackDb.executeSql(
      'SELECT id, name, createdAt, durationSeconds, distanceMeters, points ' +
        'FROM tracks ORDER BY createdAt DESC',
    );
    const loaded: Track[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      loaded.push({
        id: row.id as string,
        name: row.name as string,
        createdAt: row.createdAt as string,
        durationSeconds: row.durationSeconds as number,
        distanceMeters: row.distanceMeters as number,
        points: JSON.parse(row.points as string) as TrackPoint[],
      });
    }
    runInAction(() => {
      this.tracks = loaded;
    });
  }

  /**
   * Persists a completed recording to SQLite and adds it to the in-memory list.
   * If name is empty a default date-based name is used.
   */
  async saveTrack(
    name: string,
    durationSeconds: number,
    distanceMeters: number,
    points: TrackPoint[],
  ): Promise<Track> {
    const track: Track = {
      id: uuidv4(),
      name: name.trim() || defaultTrackName(),
      createdAt: new Date().toISOString(),
      durationSeconds,
      distanceMeters,
      points,
    };
    if (this.trackDb) {
      await this.trackDb.executeSql(
        'INSERT INTO tracks (id, name, createdAt, durationSeconds, distanceMeters, points) ' +
          'VALUES (?, ?, ?, ?, ?, ?)',
        [
          track.id,
          track.name,
          track.createdAt,
          track.durationSeconds,
          track.distanceMeters,
          JSON.stringify(track.points),
        ],
      );
    }
    runInAction(() => {
      this.tracks.unshift(track);
    });
    return track;
  }

  /**
   * Replaces or merges a list of tracks imported from a backup.
   * In replace mode all existing tracks are removed first.
   * In merge mode only tracks whose IDs do not already exist are inserted.
   */
  async importData(tracks: Track[], mode: 'replace' | 'merge'): Promise<void> {
    if (this.trackDb) {
      try {
        await this.trackDb.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.trackDb.executeSql('DELETE FROM tracks');
        }
        const sql =
          mode === 'replace'
            ? 'INSERT OR REPLACE INTO tracks (id, name, createdAt, durationSeconds, distanceMeters, points) VALUES (?, ?, ?, ?, ?, ?)'
            : 'INSERT OR IGNORE INTO tracks (id, name, createdAt, durationSeconds, distanceMeters, points) VALUES (?, ?, ?, ?, ?, ?)';
        for (const t of tracks) {
          await this.trackDb.executeSql(sql, [
            t.id,
            t.name,
            t.createdAt,
            t.durationSeconds,
            t.distanceMeters,
            JSON.stringify(t.points),
          ]);
        }
        await this.trackDb.executeSql('COMMIT');
      } catch (error) {
        await this.trackDb.executeSql('ROLLBACK');
        throw error;
      }
    }
    runInAction(() => {
      if (mode === 'replace') {
        this.tracks = [...tracks].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      } else {
        const existingIds = new Set(this.tracks.map((t) => t.id));
        const incoming = tracks.filter((t) => !existingIds.has(t.id));
        this.tracks = [...incoming, ...this.tracks].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
      }
    });
  }

  /**
   * Deletes a track by ID from both memory and SQLite.
   */
  async deleteTrack(id: string): Promise<void> {
    if (this.trackDb) {
      await this.trackDb.executeSql('DELETE FROM tracks WHERE id = ?', [id]);
    }
    runInAction(() => {
      this.tracks = this.tracks.filter((t) => t.id !== id);
    });
  }

  dispose(): void {
    this.trackDb = null;
  }
}
