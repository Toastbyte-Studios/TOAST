import { makeAutoObservable, runInAction } from 'mobx';
import { SQLiteDatabase } from '../types/database-types';

export type FontSize = 'small' | 'medium' | 'large';
export type ThemeMode = 'light' | 'dark' | 'system';
export type NoteSortOrder = 'newest-oldest' | 'oldest-newest' | 'a-z' | 'z-a';
export type MeasurementSystem = 'imperial' | 'metric';

export interface Settings {
  fontSize: FontSize;
  themeMode: ThemeMode;
  noteSortOrder: NoteSortOrder;
  measurementSystem: MeasurementSystem;
}

/**
 * Store for managing app settings like font size and theme mode.
 * Settings are persisted to SQLite database.
 */
export class SettingsStore {
  fontSize: FontSize = 'small';
  themeMode: ThemeMode = 'system';
  noteSortOrder: NoteSortOrder = 'newest-oldest';
  measurementSystem: MeasurementSystem = 'imperial';
  lastBackupAt: number | null = null;
  private settingsDb: SQLiteDatabase | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Sets the font size setting.
   * @param size - The desired font size ('small', 'medium', or 'large')
   */
  async setFontSize(size: FontSize) {
    runInAction(() => {
      this.fontSize = size;
    });
    await this.persistSettings();
  }

  /**
   * Sets the theme mode setting.
   * @param mode - The desired theme mode ('light', 'dark', or 'system')
   */
  async setThemeMode(mode: ThemeMode) {
    runInAction(() => {
      this.themeMode = mode;
    });
    await this.persistSettings();
  }

  /**
   * Sets the note sort order setting.
   * @param order - The desired sort order ('newest-oldest', 'oldest-newest', 'a-z', or 'z-a')
   */
  async setNoteSortOrder(order: NoteSortOrder) {
    runInAction(() => {
      this.noteSortOrder = order;
    });
    await this.persistSettings();
  }

  /**
   * Sets the measurement system setting.
   * @param system - The desired measurement system ('imperial' or 'metric')
   */
  async setMeasurementSystem(system: MeasurementSystem) {
    runInAction(() => {
      this.measurementSystem = system;
    });
    await this.persistSettings();
  }

  /**
   * Records the timestamp of the most recent successful backup.
   * @param timestamp - Unix timestamp (ms) of the backup.
   */
  async setLastBackupAt(timestamp: number) {
    runInAction(() => {
      this.lastBackupAt = timestamp;
    });
    await this.persistSettings();
  }

  /**
   * Gets the font scale multiplier based on the current font size setting.
   * Small = 1.0 (baseline), Medium = 1.2, Large = 1.4
   */
  get fontScale(): number {
    switch (this.fontSize) {
      case 'small':
        return 1.0;
      case 'medium':
        return 1.2;
      case 'large':
        return 1.4;
      default:
        return 1.0;
    }
  }

  /**
   * Initializes the settings database table if it doesn't exist.
   * Requires the main database to be initialized first.
   */
  async initSettingsDb(db: SQLiteDatabase): Promise<void> {
    if (!db) return;
    this.settingsDb = db;
    try {
      await this.settingsDb.executeSql(
        'CREATE TABLE IF NOT EXISTS settings (' +
          'key TEXT PRIMARY KEY NOT NULL, ' +
          'value TEXT NOT NULL' +
          ')',
      );
    } catch (error) {
      console.error('Failed to initialize settings database:', error);
    }
  }

  /**
   * Validates if a value is a valid FontSize
   */
  private isValidFontSize(value: unknown): value is FontSize {
    return (
      typeof value === 'string' && ['small', 'medium', 'large'].includes(value)
    );
  }

  /**
   * Validates if a value is a valid ThemeMode
   */
  private isValidThemeMode(value: unknown): value is ThemeMode {
    return (
      typeof value === 'string' && ['light', 'dark', 'system'].includes(value)
    );
  }

  /**
   * Validates if a value is a valid NoteSortOrder
   */
  private isValidNoteSortOrder(value: unknown): value is NoteSortOrder {
    return (
      typeof value === 'string' &&
      ['newest-oldest', 'oldest-newest', 'a-z', 'z-a'].includes(value)
    );
  }

  /**
   * Validates if a value is a valid MeasurementSystem
   */
  private isValidMeasurementSystem(value: unknown): value is MeasurementSystem {
    return typeof value === 'string' && ['imperial', 'metric'].includes(value);
  }

  /**
   * Loads settings from the database.
   */
  async loadSettings(db: SQLiteDatabase): Promise<void> {
    await this.initSettingsDb(db);
    if (!this.settingsDb) return;

    try {
      // Load font size
      const fontSizeRes = await this.settingsDb.executeSql(
        "SELECT value FROM settings WHERE key = 'fontSize'",
      );
      if (fontSizeRes[0].rows.length > 0) {
        const value = fontSizeRes[0].rows.item(0).value;
        if (this.isValidFontSize(value)) {
          runInAction(() => {
            this.fontSize = value;
          });
        } else {
          console.warn(
            `Invalid fontSize value in database: ${value}, using default 'small'`,
          );
        }
      }

      // Load theme mode
      const themeModeRes = await this.settingsDb.executeSql(
        "SELECT value FROM settings WHERE key = 'themeMode'",
      );
      if (themeModeRes[0].rows.length > 0) {
        const value = themeModeRes[0].rows.item(0).value;
        if (this.isValidThemeMode(value)) {
          runInAction(() => {
            this.themeMode = value;
          });
        } else {
          console.warn(
            `Invalid themeMode value in database: ${value}, using default 'light'`,
          );
        }
      }

      // Load note sort order
      const noteSortOrderRes = await this.settingsDb.executeSql(
        "SELECT value FROM settings WHERE key = 'noteSortOrder'",
      );
      if (noteSortOrderRes[0].rows.length > 0) {
        const value = noteSortOrderRes[0].rows.item(0).value;
        if (this.isValidNoteSortOrder(value)) {
          runInAction(() => {
            this.noteSortOrder = value;
          });
        } else {
          console.warn(
            `Invalid noteSortOrder value in database: ${value}, using default 'newest-oldest'`,
          );
        }
      }

      // Load measurement system
      const measurementSystemRes = await this.settingsDb.executeSql(
        "SELECT value FROM settings WHERE key = 'measurementSystem'",
      );
      if (measurementSystemRes[0].rows.length > 0) {
        const value = measurementSystemRes[0].rows.item(0).value;
        if (this.isValidMeasurementSystem(value)) {
          runInAction(() => {
            this.measurementSystem = value;
          });
        } else {
          console.warn(
            `Invalid measurementSystem value in database: ${value}, using default 'imperial'`,
          );
        }
      }

      // Load last backup timestamp
      const lastBackupRes = await this.settingsDb.executeSql(
        "SELECT value FROM settings WHERE key = 'lastBackupAt'",
      );
      if (lastBackupRes[0].rows.length > 0) {
        const value = Number(lastBackupRes[0].rows.item(0).value);
        if (!isNaN(value)) {
          runInAction(() => {
            this.lastBackupAt = value;
          });
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Persists current settings to the database.
   */
  async persistSettings(): Promise<void> {
    if (!this.settingsDb) return;

    try {
      await this.settingsDb.executeSql(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('fontSize', ?)",
        [this.fontSize],
      );
      await this.settingsDb.executeSql(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('themeMode', ?)",
        [this.themeMode],
      );
      await this.settingsDb.executeSql(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('noteSortOrder', ?)",
        [this.noteSortOrder],
      );
      await this.settingsDb.executeSql(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('measurementSystem', ?)",
        [this.measurementSystem],
      );
      if (this.lastBackupAt !== null) {
        await this.settingsDb.executeSql(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('lastBackupAt', ?)",
          [String(this.lastBackupAt)],
        );
      }
    } catch (error) {
      console.error('Failed to persist settings:', error);
    }
  }
}
