import { NetworkManager } from '@maplibre/maplibre-react-native';
import { makeAutoObservable } from 'mobx';

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
   * The observable flag is only updated if the native call succeeds, so the
   * UI/banner never claim a simulated-offline state we failed to actually
   * enter. A QA banner that lies about the network is worse than a no-op
   * toggle: the tester would believe they're exercising offline behavior while
   * tiles keep loading.
   *
   * @param next - True to simulate offline (block network), false to restore.
   */
  setSimulatedOffline(next: boolean) {
    // NetworkManager.setConnected(false) === offline, so invert.
    try {
      NetworkManager.setConnected(!next);
    } catch (error) {
      // Native call failed — leave the flag untouched so the UI reflects the
      // actual (unchanged) network state rather than our intent. Dev logs only.
      console.warn('DevToolsStore: NetworkManager.setConnected failed', error);
      return;
    }
    this.simulatedOffline = next;
  }

  /**
   * Restore the network connection before this store is torn down.
   *
   * Called from RootStore.reset() so a mid-session reset while offline is
   * simulated doesn't leave MapLibre stuck in a disconnected state — the
   * replacement store starts with simulatedOffline=false, so without this the
   * native layer and the new flag would disagree.
   */
  dispose() {
    if (!this.simulatedOffline) {
      return;
    }
    try {
      NetworkManager.setConnected(true);
    } catch (error) {
      console.warn(
        'DevToolsStore: NetworkManager.setConnected(true) failed during dispose',
        error,
      );
    }
  }
}
