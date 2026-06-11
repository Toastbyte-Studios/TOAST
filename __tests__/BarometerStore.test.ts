/**
 * @format
 */

import { barometer } from 'react-native-sensors';
import { BarometerStore } from '../src/stores/BarometerStore';

// Helpers
const makeDb = (rows: { pressure: number; timestamp: number }[] = []) => ({
  executeSql: jest.fn().mockResolvedValue([
    {
      rows: {
        length: rows.length,
        item: (i: number) => rows[i],
      },
    },
  ]),
});

describe('BarometerStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('start()', () => {
    test('sets available=false and error when barometer emits error', async () => {
      // Make barometer.subscribe call the error callback
      (barometer.subscribe as jest.Mock).mockImplementationOnce(
        (_next: unknown, error: (e: Error) => void) => {
          error(new Error('Sensor unavailable'));
          return { unsubscribe: jest.fn() };
        },
      );

      const store = new BarometerStore();
      await store.start(makeDb() as any);

      expect(store.available).toBe(false);
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Barometer not available on this device.');
    });

    test('sets available=false and friendly error when subscribe throws', async () => {
      (barometer.subscribe as jest.Mock).mockImplementationOnce(() => {
        throw new Error('No sensor');
      });

      const store = new BarometerStore();
      await store.start(makeDb() as any);

      expect(store.available).toBe(false);
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Barometer not available on this device.');
    });

    test('loads persisted history from the database on start', async () => {
      const rows = [
        { pressure: 1013.0, timestamp: Date.now() - 3600_000 },
        { pressure: 1012.5, timestamp: Date.now() - 1800_000 },
      ];
      const store = new BarometerStore();
      await store.start(makeDb(rows) as any);

      expect(store.history.length).toBe(2);
      expect(store.currentPressure).toBe(1012.5);
      expect(store.loading).toBe(false);
    });

    test('subscribes to the barometer observable on start', async () => {
      const store = new BarometerStore();
      await store.start(makeDb() as any);

      expect(barometer.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    test('calls unsubscribe on the subscription', async () => {
      const unsubscribe = jest.fn();
      (barometer.subscribe as jest.Mock).mockReturnValueOnce({ unsubscribe });

      const store = new BarometerStore();
      await store.start(makeDb() as any);
      store.stop();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    test('stop() is safe to call before start()', () => {
      const store = new BarometerStore();
      expect(() => store.stop()).not.toThrow();
    });
  });

  describe('handleReading (via barometer subscription)', () => {
    test('updates currentPressure and history when a reading arrives', async () => {
      let capturedNext: ((data: { pressure: number }) => void) | null = null;
      (barometer.subscribe as jest.Mock).mockImplementationOnce(
        (next: (data: { pressure: number }) => void) => {
          capturedNext = next;
          return { unsubscribe: jest.fn() };
        },
      );

      const store = new BarometerStore();
      await store.start(makeDb() as any);

      // Simulate a sensor reading
      capturedNext!({ pressure: 1015.3 });

      // Allow microtasks to flush
      await Promise.resolve();

      expect(store.currentPressure).toBe(1015.3);
      expect(store.history.length).toBe(1);
      expect(store.history[0].pressure).toBe(1015.3);
      expect(store.available).toBe(true);
      expect(store.loading).toBe(false);
    });

    test('caps history at MAX_SAMPLES using circular buffer', async () => {
      let capturedNext: ((data: { pressure: number }) => void) | null = null;
      (barometer.subscribe as jest.Mock).mockImplementationOnce(
        (next: (data: { pressure: number }) => void) => {
          capturedNext = next;
          return { unsubscribe: jest.fn() };
        },
      );

      // Pre-fill history with MAX_SAMPLES rows so the store starts at capacity
      const MAX_SAMPLES = 1440;
      const rows = Array.from({ length: MAX_SAMPLES }, (_, i) => ({
        pressure: 1013 + i * 0.001,
        timestamp: Date.now() - (MAX_SAMPLES - i) * 60_000,
      }));

      const store = new BarometerStore();
      await store.start(makeDb(rows) as any);

      expect(store.history.length).toBe(MAX_SAMPLES);

      // Push one more reading
      capturedNext!({ pressure: 1020.0 });
      await Promise.resolve();

      // Should remain capped, not grow beyond MAX_SAMPLES
      expect(store.history.length).toBe(MAX_SAMPLES);
      // The newest reading should now be the last entry
      expect(store.history[store.history.length - 1].pressure).toBe(1020.0);
    });

    test('persists new reading to the database', async () => {
      let capturedNext: ((data: { pressure: number }) => void) | null = null;
      (barometer.subscribe as jest.Mock).mockImplementationOnce(
        (next: (data: { pressure: number }) => void) => {
          capturedNext = next;
          return { unsubscribe: jest.fn() };
        },
      );

      const db = makeDb();
      const store = new BarometerStore();
      await store.start(db as any);

      db.executeSql.mockClear();

      capturedNext!({ pressure: 1014.0 });
      await new Promise<void>((r) => setTimeout(() => r(), 0));

      const calls = db.executeSql.mock.calls.map((c: [string]) => c[0]);
      expect(calls).toContain('BEGIN TRANSACTION');
      expect(
        calls.some((q: string) => q.includes('INSERT INTO pressure_history')),
      ).toBe(true);
      expect(calls).toContain('COMMIT');
    });
  });

  describe('initial state', () => {
    test('starts with expected defaults', () => {
      const store = new BarometerStore();

      expect(store.currentPressure).toBeNull();
      expect(store.history).toEqual([]);
      expect(store.available).toBe(true);
      expect(store.loading).toBe(true);
      expect(store.error).toBeNull();
    });
  });
});
