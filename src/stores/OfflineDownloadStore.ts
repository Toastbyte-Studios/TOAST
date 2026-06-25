import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAutoObservable, runInAction } from 'mobx';
import {
  OfflineMapService,
  type OfflineMapPackMetadata,
} from '../navigation/services/OfflineMapService';
import type {
  OfflinePack,
  OfflinePackStatus,
} from '@maplibre/maplibre-react-native';

const STORAGE_KEY = '@offline/active_pack';

/**
 * Fallback heuristic (bytes/tile) used only when the native status does not
 * report a real `completedResourceSize`. Matches the low end of
 * OfflineMapService's per-zoom table for the default z8–13 pack.
 */
const FALLBACK_BYTES_PER_RESOURCE = 3000;

export type ActiveDownloadState = 'inactive' | 'active' | 'complete' | 'error';

export class OfflineDownloadStore {
  id: string | null = null;
  percentage = 0;
  completedResourceCount = 0;
  totalResourceCount = 0;
  completedResourceSize = 0;
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
      this.completedResourceSize = 0;
      this.state = 'active';
      this.errorMessage = null;
    });
    this._persistId(pack.id);
  }

  handleProgress(_pack: OfflinePack, status: OfflinePackStatus): void {
    runInAction(() => {
      this.completedResourceCount = status.completedResourceCount;
      this.totalResourceCount = status.requiredResourceCount;
      this.completedResourceSize = status.completedResourceSize ?? 0;
      this.percentage =
        status.requiredResourceCount > 0
          ? Math.round(
              (status.completedResourceCount / status.requiredResourceCount) *
                100,
            )
          : 0;
      if (
        status.completedResourceCount >= status.requiredResourceCount &&
        status.requiredResourceCount > 0
      ) {
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
      this.completedResourceSize = 0;
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
      const status = match.status;
      runInAction(() => {
        this.id = id;
        this.state = 'active';
        // Seed from the last-known status so the chip shows real progress
        // immediately rather than flashing 0% until the next native tick.
        this.completedResourceCount = status.completedResourceCount;
        this.totalResourceCount = status.requiredResourceCount;
        this.completedResourceSize = status.completedResourceSize ?? 0;
        this.percentage =
          status.requiredResourceCount > 0
            ? Math.round(
                (status.completedResourceCount /
                  status.requiredResourceCount) *
                  100,
              )
            : 0;
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
    // Prefer the native-reported byte count; fall back to a per-resource
    // heuristic only when the platform doesn't populate completedResourceSize.
    const bytes =
      this.completedResourceSize > 0
        ? this.completedResourceSize
        : this.completedResourceCount * FALLBACK_BYTES_PER_RESOURCE;
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(1);
  }
}

// Re-export the metadata type so importers don't need to reach into OfflineMapService
export type { OfflineMapPackMetadata };
