import { makeAutoObservable, runInAction } from 'mobx';
import {
  barometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { SQLiteDatabase } from '../types/database-types';

export interface PressureSample {
  pressure: number; // hPa
  timestamp: number; // ms since epoch
}

const MAX_HISTORY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SAMPLES = 1440; // 1 per minute × 60 min × 24 h
const BAROMETER_READ_INTERVAL_MS = 60_000; // 1 reading per minute
/** Prune stale DB rows every N writes to reduce I/O overhead. */
const DB_PRUNE_INTERVAL = 10;
const BAROMETER_UNAVAILABLE_MESSAGE = 'Barometer not available on this device.';

/**
 * Manages the device barometer sensor, persisting readings to SQLite so that
 * pressure history is available from the moment the user opens the Barometric
 * Pressure screen, regardless of how recently the screen was last visited.
 *
 * Lifecycle:
 *  - start(db)  called from StoreProvider after the database is initialised
 *  - stop()     called from StoreProvider cleanup (app unmount / store reset)
 */
export class BarometerStore {
  currentPressure: number | null = null;
  history: PressureSample[] = [];
  available: boolean = true;
  loading: boolean = true;
  error: string | null = null;

  private db: SQLiteDatabase | null = null;
  private subscription: { unsubscribe: () => void } | null = null;
  private writesSinceLastPrune: number = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async start(db: SQLiteDatabase): Promise<void> {
    this.db = db;
    await this.initTable();
    await this.loadHistory();
    this.subscribe();
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private async initTable(): Promise<void> {
    if (!this.db) {
      return;
    }
    try {
      await this.db.executeSql(
        `CREATE TABLE IF NOT EXISTS pressure_history (
           pressure  REAL    NOT NULL,
           timestamp INTEGER NOT NULL
         )`,
      );
      await this.db.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_pressure_ts
           ON pressure_history (timestamp)`,
      );
    } catch (e) {
      console.warn('BarometerStore: failed to create table', e);
    }
  }

  private async loadHistory(): Promise<void> {
    if (!this.db) {
      return;
    }
    try {
      const cutoff = Date.now() - MAX_HISTORY_MS;
      const res = await this.db.executeSql(
        'SELECT pressure, timestamp FROM pressure_history WHERE timestamp >= ? ORDER BY timestamp ASC',
        [cutoff],
      );
      const rows = res[0].rows;
      const loaded: PressureSample[] = [];
      for (let i = 0; i < rows.length; i++) {
        loaded.push(rows.item(i) as unknown as PressureSample);
      }
      runInAction(() => {
        this.history = loaded;
        if (loaded.length > 0) {
          this.currentPressure = loaded[loaded.length - 1].pressure;
          this.loading = false;
        }
      });
    } catch (e) {
      console.warn('BarometerStore: failed to load history', e);
    }
  }

  private subscribe(): void {
    try {
      setUpdateIntervalForType(
        SensorTypes.barometer,
        BAROMETER_READ_INTERVAL_MS,
      );
      this.subscription = barometer.subscribe(
        ({ pressure: p }) => {
          // Always use Date.now() for a consistent JS-runtime timestamp,
          // independent of sensor clock format or timezone variations.
          this.handleReading({ pressure: p, timestamp: Date.now() });
        },
        (_err: Error) => {
          runInAction(() => {
            this.available = false;
            this.loading = false;
            this.error = BAROMETER_UNAVAILABLE_MESSAGE;
          });
        },
      );
    } catch {
      runInAction(() => {
        this.available = false;
        this.loading = false;
        this.error = BAROMETER_UNAVAILABLE_MESSAGE;
      });
    }
  }

  private async handleReading(sample: PressureSample): Promise<void> {
    runInAction(() => {
      this.currentPressure = sample.pressure;
      this.loading = false;
      this.available = true;
      // Circular buffer — drop the oldest entry before pushing to avoid
      // creating large temporary arrays when the buffer is full.
      if (this.history.length >= MAX_SAMPLES) {
        this.history.shift();
      }
      this.history.push(sample);
    });

    if (!this.db) {
      return;
    }
    try {
      this.writesSinceLastPrune += 1;
      // Group INSERT and periodic prune inside a single transaction to
      // reduce database round-trips.
      await this.db.executeSql('BEGIN TRANSACTION');
      try {
        await this.db.executeSql(
          'INSERT INTO pressure_history (pressure, timestamp) VALUES (?, ?)',
          [sample.pressure, sample.timestamp],
        );
        if (this.writesSinceLastPrune % DB_PRUNE_INTERVAL === 0) {
          await this.db.executeSql(
            'DELETE FROM pressure_history WHERE timestamp < ?',
            [Date.now() - MAX_HISTORY_MS],
          );
        }
        await this.db.executeSql('COMMIT');
      } catch (e) {
        await this.db.executeSql('ROLLBACK');
        throw e;
      }
    } catch (e) {
      console.warn('BarometerStore: failed to persist reading', e);
    }
  }
}
