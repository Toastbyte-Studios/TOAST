import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineMapService } from '../src/navigation/services/OfflineMapService';
import { OfflineDownloadStore } from '../src/stores/OfflineDownloadStore';
import type {
  OfflinePack,
  OfflinePackStatus,
} from '@maplibre/maplibre-react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/navigation/services/OfflineMapService', () => ({
  OfflineMapService: {
    listPacks: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  },
}));

const mockPack = (id = 'test-id') =>
  ({ id, metadata: {}, status: { state: 'active' } }) as unknown as OfflinePack;

const mockStatus = (completed: number, total: number): OfflinePackStatus => ({
  id: 'test-id',
  completedResourceCount: completed,
  requiredResourceCount: total,
  completedResourceSize: 0,
  completedTileCount: 0,
  completedTileSize: 0,
  percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  state: total > 0 && completed >= total ? 'complete' : 'active',
});

const mockError = (message = 'Network error') => ({ message });

describe('OfflineDownloadStore', () => {
  let store: OfflineDownloadStore;

  beforeEach(() => {
    store = new OfflineDownloadStore();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts inactive with null id', () => {
      expect(store.state).toBe('inactive');
      expect(store.id).toBeNull();
      expect(store.percentage).toBe(0);
    });
  });

  describe('start()', () => {
    it('sets id and state to active', () => {
      store.start(mockPack('abc'));
      expect(store.id).toBe('abc');
      expect(store.state).toBe('active');
    });

    it('persists the pack id to AsyncStorage', () => {
      store.start(mockPack('abc'));
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@offline/active_pack',
        JSON.stringify('abc'),
      );
    });

    it('resets percentage and error', () => {
      store.start(mockPack('abc'));
      expect(store.percentage).toBe(0);
      expect(store.errorMessage).toBeNull();
    });
  });

  describe('handleProgress()', () => {
    it('updates percentage correctly', () => {
      store.start(mockPack());
      store.handleProgress(mockPack(), mockStatus(50, 100));
      expect(store.percentage).toBe(50);
      expect(store.completedResourceCount).toBe(50);
    });

    it('transitions to complete when all resources downloaded', () => {
      store.start(mockPack());
      store.handleProgress(mockPack(), mockStatus(100, 100));
      expect(store.state).toBe('complete');
    });

    it('clears persisted id on completion', () => {
      store.start(mockPack());
      jest.clearAllMocks();
      store.handleProgress(mockPack(), mockStatus(100, 100));
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@offline/active_pack',
      );
    });

    it('handles 0 expected resources without dividing by zero', () => {
      store.start(mockPack());
      store.handleProgress(mockPack(), mockStatus(0, 0));
      expect(store.percentage).toBe(0);
    });
  });

  describe('handleError()', () => {
    it('transitions to error state with message', () => {
      store.start(mockPack());
      store.handleError(mockPack(), mockError('Disk full'));
      expect(store.state).toBe('error');
      expect(store.errorMessage).toBe('Disk full');
    });

    it('clears persisted id on error', () => {
      store.start(mockPack());
      jest.clearAllMocks();
      store.handleError(mockPack(), mockError());
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@offline/active_pack',
      );
    });
  });

  describe('clear()', () => {
    it('resets all fields to initial values', () => {
      store.start(mockPack());
      store.handleProgress(mockPack(), mockStatus(50, 100));
      store.clear();
      expect(store.state).toBe('inactive');
      expect(store.id).toBeNull();
      expect(store.percentage).toBe(0);
      expect(store.errorMessage).toBeNull();
    });

    it('removes persisted id from AsyncStorage', () => {
      store.clear();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@offline/active_pack',
      );
    });
  });

  describe('recover()', () => {
    it('no-ops when storage is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await store.recover();
      expect(store.state).toBe('inactive');
      expect(OfflineMapService.subscribe).not.toHaveBeenCalled();
    });

    it('re-subscribes to an in-progress pack', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify('abc'),
      );
      (OfflineMapService.listPacks as jest.Mock).mockResolvedValue([
        { id: 'abc', status: { state: 'active' } },
      ]);
      (OfflineMapService.subscribe as jest.Mock).mockResolvedValue(undefined);

      await store.recover();

      expect(store.id).toBe('abc');
      expect(store.state).toBe('active');
      expect(OfflineMapService.subscribe).toHaveBeenCalledWith(
        'abc',
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('clears storage when pack is already complete', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify('abc'),
      );
      (OfflineMapService.listPacks as jest.Mock).mockResolvedValue([
        { id: 'abc', status: { state: 'complete' } },
      ]);

      await store.recover();

      expect(store.state).toBe('inactive');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@offline/active_pack',
      );
    });

    it('clears storage when pack is not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify('gone'),
      );
      (OfflineMapService.listPacks as jest.Mock).mockResolvedValue([]);

      await store.recover();

      expect(store.state).toBe('inactive');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@offline/active_pack',
      );
    });

    it('survives AsyncStorage failure without throwing', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('IO error'),
      );
      await expect(store.recover()).resolves.not.toThrow();
    });
  });

  describe('computed: isActive', () => {
    it('is false when inactive', () => {
      expect(store.isActive).toBe(false);
    });

    it('is true when active', () => {
      store.start(mockPack());
      expect(store.isActive).toBe(true);
    });
  });
});
