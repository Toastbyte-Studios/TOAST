/**
 * @format
 */

import { SettingsStore } from '../src/stores/SettingsStore';

// Mock database for testing
const createMockDatabase = () => {
  const storage: Record<string, string> = {};

  return {
    executeSql: jest.fn(
      (query: string, params?: Array<string | number | boolean | null>) => {
        // Handle CREATE TABLE
        if (query.includes('CREATE TABLE')) {
          return Promise.resolve([{ rows: { length: 0 } }]);
        }

        // Handle INSERT OR REPLACE
        // Query format: "INSERT OR REPLACE INTO settings (key, value) VALUES ('fontSize', ?)"
        if (query.includes('INSERT OR REPLACE')) {
          // Extract key from the query
          const keyMatch = query.match(/VALUES \('([^']+)'/);
          if (keyMatch && params && params.length > 0) {
            const key = keyMatch[1]; // e.g., 'fontSize'
            const value = params[0]; // e.g., 'medium'
            storage[key] = value;
          }
          return Promise.resolve([{ rows: { length: 0 } }]);
        }

        // Handle SELECT - parse the key from the WHERE clause
        if (query.includes('SELECT')) {
          // Extract key from query like "SELECT value FROM settings WHERE key = 'fontSize'"
          const match = query.match(/key = '([^']+)'/);
          const key = match?.[1];

          if (key && storage[key] !== undefined) {
            const value = storage[key];
            return Promise.resolve([
              {
                rows: {
                  length: 1,
                  item: (_index: number) => ({ value }),
                },
              },
            ]);
          }
          return Promise.resolve([{ rows: { length: 0 } }]);
        }

        return Promise.resolve([{ rows: { length: 0 } }]);
      },
    ),
  };
};

describe('SettingsStore', () => {
  let settingsStore: SettingsStore;
  let mockDb: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsStore = new SettingsStore();
    mockDb = createMockDatabase();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(settingsStore.fontSize).toBe('small');
      expect(settingsStore.themeMode).toBe('system');
      expect(settingsStore.noteSortOrder).toBe('newest-oldest');
      expect(settingsStore.measurementSystem).toBe('imperial');
    });

    it('should make the store observable', () => {
      expect(settingsStore).toBeDefined();
      expect(typeof settingsStore.setFontSize).toBe('function');
      expect(typeof settingsStore.setThemeMode).toBe('function');
      expect(typeof settingsStore.setNoteSortOrder).toBe('function');
      expect(typeof settingsStore.setMeasurementSystem).toBe('function');
    });
  });

  describe('fontScale getter', () => {
    it('should return 1.0 for small font size', () => {
      settingsStore.fontSize = 'small';
      expect(settingsStore.fontScale).toBe(1.0);
    });

    it('should return 1.2 for medium font size', () => {
      settingsStore.fontSize = 'medium';
      expect(settingsStore.fontScale).toBe(1.2);
    });

    it('should return 1.4 for large font size', () => {
      settingsStore.fontSize = 'large';
      expect(settingsStore.fontScale).toBe(1.4);
    });

    it('should return 1.0 for invalid font size', () => {
      (settingsStore as unknown as { fontSize: string }).fontSize = 'invalid';
      expect(settingsStore.fontScale).toBe(1.0);
    });
  });

  describe('setFontSize', () => {
    beforeEach(async () => {
      await settingsStore.initSettingsDb(mockDb);
    });

    it('should update fontSize to small', async () => {
      await settingsStore.setFontSize('small');
      expect(settingsStore.fontSize).toBe('small');
    });

    it('should update fontSize to medium', async () => {
      await settingsStore.setFontSize('medium');
      expect(settingsStore.fontSize).toBe('medium');
    });

    it('should update fontSize to large', async () => {
      await settingsStore.setFontSize('large');
      expect(settingsStore.fontSize).toBe('large');
    });

    it('should persist fontSize to database', async () => {
      await settingsStore.setFontSize('medium');
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('fontSize', ?)",
        ['medium'],
      );
    });

    it('should update fontScale when fontSize changes', async () => {
      await settingsStore.setFontSize('medium');
      expect(settingsStore.fontScale).toBe(1.2);

      await settingsStore.setFontSize('large');
      expect(settingsStore.fontScale).toBe(1.4);
    });
  });

  describe('setThemeMode', () => {
    beforeEach(async () => {
      await settingsStore.initSettingsDb(mockDb);
    });

    it('should update themeMode to light', async () => {
      await settingsStore.setThemeMode('light');
      expect(settingsStore.themeMode).toBe('light');
    });

    it('should update themeMode to dark', async () => {
      await settingsStore.setThemeMode('dark');
      expect(settingsStore.themeMode).toBe('dark');
    });

    it('should update themeMode to system', async () => {
      await settingsStore.setThemeMode('system');
      expect(settingsStore.themeMode).toBe('system');
    });

    it('should persist themeMode to database', async () => {
      await settingsStore.setThemeMode('dark');
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('themeMode', ?)",
        ['dark'],
      );
    });
  });

  describe('setNoteSortOrder', () => {
    beforeEach(async () => {
      await settingsStore.initSettingsDb(mockDb);
    });

    it('should update noteSortOrder to newest-oldest', async () => {
      await settingsStore.setNoteSortOrder('newest-oldest');
      expect(settingsStore.noteSortOrder).toBe('newest-oldest');
    });

    it('should update noteSortOrder to oldest-newest', async () => {
      await settingsStore.setNoteSortOrder('oldest-newest');
      expect(settingsStore.noteSortOrder).toBe('oldest-newest');
    });

    it('should update noteSortOrder to a-z', async () => {
      await settingsStore.setNoteSortOrder('a-z');
      expect(settingsStore.noteSortOrder).toBe('a-z');
    });

    it('should update noteSortOrder to z-a', async () => {
      await settingsStore.setNoteSortOrder('z-a');
      expect(settingsStore.noteSortOrder).toBe('z-a');
    });

    it('should persist noteSortOrder to database', async () => {
      await settingsStore.setNoteSortOrder('a-z');
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('noteSortOrder', ?)",
        ['a-z'],
      );
    });
  });

  describe('setMeasurementSystem', () => {
    beforeEach(async () => {
      await settingsStore.initSettingsDb(mockDb);
    });

    it('should update measurementSystem to imperial', async () => {
      await settingsStore.setMeasurementSystem('imperial');
      expect(settingsStore.measurementSystem).toBe('imperial');
    });

    it('should update measurementSystem to metric', async () => {
      await settingsStore.setMeasurementSystem('metric');
      expect(settingsStore.measurementSystem).toBe('metric');
    });

    it('should persist measurementSystem to database', async () => {
      await settingsStore.setMeasurementSystem('metric');
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('measurementSystem', ?)",
        ['metric'],
      );
    });
  });

  describe('database initialization', () => {
    it('should initialize settings table', async () => {
      await settingsStore.initSettingsDb(mockDb);
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS settings'),
      );
    });

    it('should not initialize if db is null', async () => {
      await settingsStore.initSettingsDb(null);
      expect(mockDb.executeSql).not.toHaveBeenCalled();
    });

    it('should handle database initialization errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const errorDb = {
        executeSql: jest.fn().mockRejectedValue(new Error('DB error')),
      };

      await settingsStore.initSettingsDb(errorDb);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize settings database:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('loadSettings', () => {
    beforeEach(async () => {
      await settingsStore.initSettingsDb(mockDb);
    });

    it('should load fontSize from database', async () => {
      // Set and persist fontSize with first store
      await settingsStore.setFontSize('large');

      // Create new store with same database to simulate reload
      const newStore = new SettingsStore();
      await newStore.initSettingsDb(mockDb);
      await newStore.loadSettings(mockDb);

      expect(newStore.fontSize).toBe('large');
    });

    it('should load themeMode from database', async () => {
      // Set and persist themeMode with first store
      await settingsStore.setThemeMode('dark');

      // Create new store with same database to simulate reload
      const newStore = new SettingsStore();
      await newStore.initSettingsDb(mockDb);
      await newStore.loadSettings(mockDb);

      expect(newStore.themeMode).toBe('dark');
    });

    it('should load noteSortOrder from database', async () => {
      // Set and persist noteSortOrder with first store
      await settingsStore.setNoteSortOrder('a-z');

      // Create new store with same database to simulate reload
      const newStore = new SettingsStore();
      await newStore.initSettingsDb(mockDb);
      await newStore.loadSettings(mockDb);

      expect(newStore.noteSortOrder).toBe('a-z');
    });

    it('should load measurementSystem from database', async () => {
      // Set and persist measurementSystem with first store
      await settingsStore.setMeasurementSystem('metric');

      // Create new store with same database to simulate reload
      const newStore = new SettingsStore();
      await newStore.initSettingsDb(mockDb);
      await newStore.loadSettings(mockDb);

      expect(newStore.measurementSystem).toBe('metric');
    });

    it('should use default values if database is empty', async () => {
      const newStore = new SettingsStore();
      const emptyDb = createMockDatabase();
      await newStore.initSettingsDb(emptyDb);
      await newStore.loadSettings(emptyDb);

      expect(newStore.fontSize).toBe('small');
      expect(newStore.themeMode).toBe('system');
      expect(newStore.noteSortOrder).toBe('newest-oldest');
      expect(newStore.measurementSystem).toBe('imperial');
    });

    it('should handle load errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const errorDb = {
        executeSql: jest.fn().mockRejectedValue(new Error('Load error')),
      };

      await settingsStore.loadSettings(errorDb);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load settings:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('persistSettings', () => {
    it('should not persist if database is not initialized', async () => {
      await settingsStore.setFontSize('medium');
      // Should not throw error even without db
      expect(settingsStore.fontSize).toBe('medium');
    });

    it('should persist both fontSize and themeMode', async () => {
      await settingsStore.initSettingsDb(mockDb);
      settingsStore.fontSize = 'large';
      settingsStore.themeMode = 'dark';

      await (
        settingsStore as unknown as { persistSettings(): Promise<void> }
      ).persistSettings();

      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('fontSize', ?)",
        ['large'],
      );
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('themeMode', ?)",
        ['dark'],
      );
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('noteSortOrder', ?)",
        ['newest-oldest'],
      );
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('measurementSystem', ?)",
        ['imperial'],
      );
    });

    it('should handle persist errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const errorDb = {
        executeSql: jest.fn().mockRejectedValue(new Error('Persist error')),
      };

      await settingsStore.initSettingsDb(errorDb);
      await (
        settingsStore as unknown as { persistSettings(): Promise<void> }
      ).persistSettings();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to persist settings:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('MobX reactivity', () => {
    it('should trigger reactions when fontSize changes', (done) => {
      let reactionCount = 0;
      const { autorun } = require('mobx');

      const dispose = autorun(() => {
        // Access fontSize to make it observed
        settingsStore.fontSize;
        reactionCount++;
      });

      // First run happens immediately
      expect(reactionCount).toBe(1);

      // Change fontSize
      settingsStore.setFontSize('medium').then(() => {
        // Should trigger reaction
        expect(reactionCount).toBe(2);
        dispose();
        done();
      });
    });

    it('should trigger reactions when themeMode changes', (done) => {
      let reactionCount = 0;
      const { autorun } = require('mobx');

      const dispose = autorun(() => {
        // Access themeMode to make it observed
        settingsStore.themeMode;
        reactionCount++;
      });

      // First run happens immediately
      expect(reactionCount).toBe(1);

      // Change themeMode
      settingsStore.setThemeMode('dark').then(() => {
        // Should trigger reaction
        expect(reactionCount).toBe(2);
        dispose();
        done();
      });
    });

    it('should trigger reactions when fontScale changes due to fontSize', (done) => {
      let observedScale = 1.0;
      const { autorun } = require('mobx');

      const dispose = autorun(() => {
        observedScale = settingsStore.fontScale;
      });

      // Initial value
      expect(observedScale).toBe(1.0);

      // Change fontSize which should update fontScale
      settingsStore.setFontSize('large').then(() => {
        expect(observedScale).toBe(1.4);
        dispose();
        done();
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid setting changes without race conditions', async () => {
      await settingsStore.initSettingsDb(mockDb);

      // Rapidly change settings
      const promises = [
        settingsStore.setFontSize('medium'),
        settingsStore.setThemeMode('dark'),
        settingsStore.setFontSize('large'),
        settingsStore.setThemeMode('system'),
      ];

      await Promise.all(promises);

      // Should end up with the last values set
      expect(settingsStore.fontSize).toBe('large');
      expect(settingsStore.themeMode).toBe('system');
    });

    it('should maintain settings through store lifecycle', async () => {
      await settingsStore.initSettingsDb(mockDb);

      // Set initial values
      await settingsStore.setFontSize('large');
      await settingsStore.setThemeMode('dark');
      await settingsStore.setNoteSortOrder('a-z');
      await settingsStore.setMeasurementSystem('metric');

      // Simulate app restart by creating new store with same database
      const newStore = new SettingsStore();
      await newStore.initSettingsDb(mockDb);
      await newStore.loadSettings(mockDb);

      // Settings should be restored
      expect(newStore.fontSize).toBe('large');
      expect(newStore.themeMode).toBe('dark');
      expect(newStore.noteSortOrder).toBe('a-z');
      expect(newStore.measurementSystem).toBe('metric');
      expect(newStore.fontScale).toBe(1.4);
    });
  });
});
