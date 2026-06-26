import { NetworkManager } from '@maplibre/maplibre-react-native';
import { makeAutoObservable, runInAction } from 'mobx';

/**
 * Dev-only store for QA tooling.
 *
 * Currently holds the "simulate offline" toggle used to validate offline map
 * behavior without touching the OS network state. It drives MapLibre's
 * {@link NetworkManager.setConnected}, which blocks all style/source/tile
 * network requests when set to disconnected — so the map renders only what has
 * already been downloaded offline.
 *
 * This state is intentionally NOT persisted: it always starts "connected" on a
 * fresh app launch (RootStore constructs a new instance at startup), so no one
 * is confused by a leftover simulated-offline state from a previous session.
 *
 * The toggle UI is gated behind `__DEV__` and tree-shaken out of release
 * builds; this store is inert there because nothing flips the flag.
 */
export class DevToolsStore {
  /** When true, MapLibre network requests are blocked to simulate offline. */
  simulatedOffline: boolean = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Toggles simulated-offline mode.
   *
   * @param next - True to simulate offline (block network), false to restore.
   */
  setSimulatedOffline(next: boolean) {
    // NetworkManager.setConnected(false) === offline, so invert.
    try {
      NetworkManager.setConnected(!next);
    } catch (error) {
      // Non-fatal: keep the flag in sync with intent even if the native call
      // fails, so the UI and banner stay consistent. Surfaced in dev logs only.
      console.warn('DevToolsStore: NetworkManager.setConnected failed', error);
    }
    runInAction(() => {
      this.simulatedOffline = next;
    });
  }
}
