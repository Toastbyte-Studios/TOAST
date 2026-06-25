import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAutoObservable, runInAction } from 'mobx';
import {
  OfflineMapService,
  type OfflineMapPackMetadata,
} from '../navigation/services/OfflineMapService';
import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';

const STORAGE_KEY = '@offline/active_pack';

export type ActiveDownloadState = 'inactive' | 'active' | 'complete' | 'error';

export class OfflineDownloadStore {
  id: string | null = null;
  percentage = 0;
  completedResourceCount = 0;
  totalResourceCount = 0;
  state: ActiveDownloadState = 'inactive';
  errorMessage: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  start(pack: OfflinePack): void {
    runInAction(() => {
      this.id = pack.id;
      this.percentage = 0;
      this.completedResourceCount = 0;
      this.totalResourceCount = 0;
      this.state = 'active';
      this.errorMessage = null;
    });
    this._persistId(pack.id);
  }

  handleProgress(_pack: OfflinePack, status: OfflinePackStatus): void {
    runInAction(() => {
      this.completedResourceCount = status.completedResourceCount;
      this.totalResourceCount = status.countOfResourcesExpected;
      this.percentage =
        status.countOfResourcesExpected > 0
          ? Math.round(
              (status.completedResourceCount /
                status.countOfResourcesExpected) *
                100,
            )
          : 0;
      if (status.completedResourceCount >= status.countOfResourcesExpected &&
          status.countOfResourcesExpected > 0) {
        this.state = 'complete';
        this._clearPersistedId();
      }
    });
  }

  handleError(_pack: OfflinePack, error: { message: string }): void {
    runInAction(() => {
      this.state = 'error';
      this.errorMessage = error.message ?? 'Download failed';
      this._clearPersistedId();
    });
  }

  clear(): void {
    runInAction(() => {
      this.id = null;
      this.percentage = 0;
      this.completedResourceCount = 0;
      this.totalResourceCount = 0;
      this.state = 'inactive';
      this.errorMessage = null;
    });
    this._clearPersistedId();
  }

  async recover(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }
      const id: string = JSON.parse(stored);
      const packs = await OfflineMapService.listPacks();
      const match = packs.find((p) => p.id === id);
      if (!match || match.status.state === 'complete') {
        // Pack is gone or already finished — clean up
        this._clearPersistedId();
        return;
      }
      runInAction(() => {
        this.id = id;
        this.state = 'active';
        this.percentage = 0;
      });
      // Re-attach listeners so progress continues after process kill
      await OfflineMapService.subscribe(
        id,
        (pack, status) => this.handleProgress(pack, status),
        (pack, error) => this.handleError(pack, error),
      );
    } catch {
      // Non-fatal — app still works without recovery
    }
  }

  dispose(): void {
    if (this.id) {
      OfflineMapService.unsubscribe(this.id);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _persistId(id: string): void {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(id)).catch(() => {});
  }

  private _clearPersistedId(): void {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  get isActive(): boolean {
    return this.state === 'active';
  }

  get completedMB(): string {
    const mb = (this.completedResourceCount * 3000) / (1024 * 1024);
    return mb.toFixed(1);
  }
}

// Re-export the metadata type so importers don't need to reach into OfflineMapService
export type { OfflineMapPackMetadata };
