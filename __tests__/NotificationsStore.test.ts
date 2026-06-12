/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationsStore } from '../src/stores/NotificationsStore';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

/**
 * Drain all pending microtasks and I/O callbacks so chained AsyncStorage
 * writes can complete before we inspect mock call counts.
 */
const flushPromises = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe('NotificationsStore', () => {
  let store: NotificationsStore;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: nothing stored yet
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    store = new NotificationsStore();
  });

  describe('initial state', () => {
    test('starts with empty hiddenKeys', () => {
      expect(store.hiddenKeys.size).toBe(0);
    });

    test('isLoaded starts false', () => {
      expect(store.isLoaded).toBe(false);
    });
  });

  describe('loadHiddenKeys()', () => {
    test('sets isLoaded=true after loading when storage is empty', async () => {
      await store.loadHiddenKeys();
      expect(store.isLoaded).toBe(true);
    });

    test('populates hiddenKeys from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(['solar-sunrise-123', 'pantry-item1-expired']),
      );
      await store.loadHiddenKeys();
      expect(store.hiddenKeys.size).toBe(2);
      expect(store.hiddenKeys.has('solar-sunrise-123')).toBe(true);
      expect(store.hiddenKeys.has('pantry-item1-expired')).toBe(true);
    });

    test('handles AsyncStorage read error gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('read error'));
      await expect(store.loadHiddenKeys()).resolves.not.toThrow();
      expect(store.isLoaded).toBe(true);
      expect(store.hiddenKeys.size).toBe(0);
    });

    test('ignores non-array JSON values in storage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('"not-an-array"');
      await store.loadHiddenKeys();
      expect(store.hiddenKeys.size).toBe(0);
    });

    test('filters out non-string entries from stored array', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(['valid-key', 42, null, true, 'another-key']),
      );
      await store.loadHiddenKeys();
      expect(store.hiddenKeys.size).toBe(2);
      expect(store.hiddenKeys.has('valid-key')).toBe(true);
      expect(store.hiddenKeys.has('another-key')).toBe(true);
    });
  });

  describe('isHidden()', () => {
    test('returns false for unknown keys', () => {
      expect(store.isHidden('unknown-key')).toBe(false);
    });

    test('returns true after hideNotification', () => {
      store.hideNotification('solar-sunrise-123');
      expect(store.isHidden('solar-sunrise-123')).toBe(true);
    });
  });

  describe('hideNotification()', () => {
    test('adds key to hiddenKeys', () => {
      store.hideNotification('pantry-item1-30day');
      expect(store.hiddenKeys.has('pantry-item1-30day')).toBe(true);
    });

    test('persists to AsyncStorage', async () => {
      store.hideNotification('astro-lunar-eclipse-1');
      // Allow the serialized persist chain to flush
      await flushPromises();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@notifications/hidden_keys',
        JSON.stringify(['astro-lunar-eclipse-1']),
      );
    });

    test('is idempotent for already-hidden keys', () => {
      store.hideNotification('weather-monthly-outlook');
      store.hideNotification('weather-monthly-outlook');
      expect(store.hiddenKeys.size).toBe(1);
    });

    test('handles AsyncStorage write error gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('write error'));
      expect(() => store.hideNotification('key')).not.toThrow();
    });
  });

  describe('unhideNotification()', () => {
    test('removes key from hiddenKeys', () => {
      store.hideNotification('solar-sunrise-123');
      store.unhideNotification('solar-sunrise-123');
      expect(store.hiddenKeys.has('solar-sunrise-123')).toBe(false);
    });

    test('persists removal to AsyncStorage', async () => {
      store.hideNotification('key-a');
      store.hideNotification('key-b');
      mockAsyncStorage.setItem.mockClear();
      store.unhideNotification('key-a');
      // Flush the serialized persist chain (3 chained writes)
      await flushPromises();
      expect(mockAsyncStorage.setItem).toHaveBeenLastCalledWith(
        '@notifications/hidden_keys',
        JSON.stringify(['key-b']),
      );
    });

    test('is a no-op for unknown keys', () => {
      expect(() => store.unhideNotification('nonexistent')).not.toThrow();
      expect(store.hiddenKeys.size).toBe(0);
    });
  });

  describe('clearHiddenKeys()', () => {
    test('empties hiddenKeys', () => {
      store.hideNotification('a');
      store.hideNotification('b');
      store.clearHiddenKeys();
      expect(store.hiddenKeys.size).toBe(0);
    });

    test('persists empty array to AsyncStorage', async () => {
      store.hideNotification('a');
      mockAsyncStorage.setItem.mockClear();
      store.clearHiddenKeys();
      // Flush the serialized persist chain (2 chained writes)
      await flushPromises();
      expect(mockAsyncStorage.setItem).toHaveBeenLastCalledWith(
        '@notifications/hidden_keys',
        JSON.stringify([]),
      );
    });
  });
});
