import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAutoObservable, runInAction } from 'mobx';
import Geolocation from 'react-native-geolocation-service';
import { NEIGHBORING_STATES } from '../data/neighboringStates';
import { distanceMiles } from '../utils/distanceMiles';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { stateFromCoordinates } from '../utils/stateFromCoordinates';

const CACHE_KEY = '@repeaterbook/cache';
const CUSTOM_KEY = '@repeaterbook/custom';
const REFETCH_THRESHOLD_MILES = 50;
const DEFAULT_RADIUS_MILES = 50;
const REPEATERBOOK_URL = 'https://www.repeaterbook.com/api/export.php';
// RepeaterBook requires a User-Agent with a URL and contact email in the form:
// "AppName/version (+https://url; email)"
// See: https://www.repeaterbook.com/wiki/doku.php?id=api
const USER_AGENT =
  'TOAST/1.0 (+https://toastbyte.studio; support@toastbyte.studio)';

export interface Repeater {
  id: string;
  callSign: string;
  frequency: string;
  offset: string;
  tone: string;
  mode: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  operationalStatus: string;
  use: string;
  notes: string;
  lastEdited: string;
  distance: number;
  emcomm: string;
  /** True when this entry was manually added by the user (not from RepeaterBook). */
  isCustom?: boolean;
}

export interface RepeaterCache {
  /** All repeaters from all queried states — not distance-filtered. */
  repeaters: Repeater[];
  queryLat: number;
  queryLng: number;
  lastUpdated: string;
  /** Which states were included in this query (for future reference). */
  queriedStates?: string[];
}

/**
 * Derives a human-readable mode string from a RepeaterBook API result row.
 */
function deriveMode(row: Record<string, string>): string {
  if (row.DMR === 'Yes') return 'DMR';
  if (row['D-Star'] === 'Yes') return 'D-STAR';
  if (row['System Fusion'] === 'Yes') return 'Fusion';
  if (row['P-25'] === 'Yes' || row['APCO P-25'] === 'Yes') return 'P-25';
  if (row.NXDN === 'Yes') return 'NXDN';
  if (row.M17 === 'Yes') return 'M17';
  if (row.Tetra === 'Yes') return 'TETRA';
  // Default: treat as FM (covers both explicit 'FM Analog: Yes' and unset fields).
  return 'FM';
}

/**
 * Maps a raw RepeaterBook API row to a Repeater object.
 */
function mapRow(
  row: Record<string, string>,
  queryLat: number,
  queryLng: number,
): Repeater {
  const lat = parseFloat(row.Lat ?? '0');
  const lng = parseFloat(row.Long ?? '0');
  const dist = distanceMiles(queryLat, queryLng, lat, lng);
  const tone = row.CTCSS || row.PL || row.DCS || '';
  return {
    id: `${row['State ID'] ?? ''}-${row['Rptr ID'] ?? ''}`,
    callSign: row['Call Sign'] ?? '',
    frequency: row.Frequency ?? '',
    offset: row.Offset ?? '',
    tone,
    mode: deriveMode(row),
    city: row['Nearest City'] ?? '',
    state: row.State ?? '',
    lat,
    lng,
    operationalStatus: row['Operational Status'] ?? '',
    use: row.Use ?? '',
    notes: row.Notes ?? '',
    lastEdited: row['Last Edited'] ?? '',
    distance: Math.round(dist * 10) / 10,
    emcomm: row.emcomm || '',
  };
}

/**
 * Fetches all repeaters for a single state from the RepeaterBook API.
 *
 * React Native's fetch implementation (and some Android WebView versions) can
 * silently strip the `User-Agent` header, which causes RepeaterBook to return
 * HTTP 401. We send the identifying string in both `User-Agent` and the custom
 * `X-App-Info` header so that RepeaterBook can authenticate the request even
 * if one of the two is dropped by the runtime.
 *
 * On network errors, request timeouts, non-OK HTTP responses, or JSON parsing
 * failures, this function rejects (throws). Callers such as `fetchRepeaters`
 * use `Promise.allSettled` so that a failure for one state does not affect
 * others.
 */
async function fetchStateRepeaters(
  state: string,
): Promise<Record<string, string>[]> {
  const url = `${REPEATERBOOK_URL}?state=${encodeURIComponent(state)}&format=json`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      // Fallback for environments that strip User-Agent (some Android versions
      // and certain React Native fetch implementations silently drop it).
      'X-App-Info': USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = await response.json();
  return Array.isArray(json?.results) ? json.results : [];
}

/**
 * Store that fetches and caches local ham radio repeaters from the
 * RepeaterBook API using a state-based query strategy.
 *
 * Behavior:
 * - On `initialize()`, cached results are loaded immediately.
 * - A live fetch is triggered when there is no cached data, or when the
 *   user's current location is more than 50 miles from the location used
 *   for the previous query.
 * - The user's state is determined from coordinates; all neighboring states
 *   are queried in parallel to ensure repeaters across state borders are found.
 * - All results are deduplicated and cached without a distance filter so that
 *   the cached data remains useful as the user moves.
 * - The cache is only replaced when a fetch succeeds.
 */
export class RepeaterBookStore {
  repeaters: Repeater[] = [];
  customRepeaters: Repeater[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  lastUpdated: string | null = null;
  isCachedData: boolean = false;
  queryLat: number | null = null;
  queryLng: number | null = null;
  selectedMode: string = 'All';
  onAirOnly: boolean = true;
  emergencyOnly: boolean = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get modes(): string[] {
    const set = new Set<string>(['All']);
    for (const r of this.repeaters) {
      if (r.mode) set.add(r.mode);
    }
    for (const r of this.customRepeaters) {
      if (r.mode) set.add(r.mode);
    }
    return Array.from(set);
  }

  /**
   * Repeaters filtered by the selected mode, on-air toggle, emergency toggle,
   * and within DEFAULT_RADIUS_MILES of the last query position, sorted by
   * distance ascending.
   *
   * @note Distances are calculated once at fetch time relative to the query
   * location and stored in the cache. They are not recalculated as the user
   * moves. Since a new fetch is triggered whenever the user moves more than
   * REFETCH_THRESHOLD_MILES (50 miles), the maximum distance drift before a
   * refresh is bounded by that threshold — this is an acceptable tradeoff for
   * an offline-first feature.
   */
  get filteredRepeaters(): Repeater[] {
    let list =
      this.selectedMode === 'All'
        ? this.repeaters
        : this.repeaters.filter((r) => r.mode === this.selectedMode);
    if (this.onAirOnly) {
      list = list.filter((r) => r.operationalStatus === 'On-air');
    }
    if (this.emergencyOnly) {
      list = list.filter((r) => Boolean(r.emcomm));
    }
    list = list.filter((r) => r.distance <= DEFAULT_RADIUS_MILES);
    const sorted = [...list].sort((a, b) => a.distance - b.distance);

    // Custom repeaters are shown at the top, not subject to distance filter.
    let custom =
      this.selectedMode === 'All'
        ? this.customRepeaters
        : this.customRepeaters.filter((r) => r.mode === this.selectedMode);
    if (this.onAirOnly) {
      custom = custom.filter((r) => r.operationalStatus === 'On-air');
    }
    if (this.emergencyOnly) {
      custom = custom.filter((r) => Boolean(r.emcomm));
    }

    return [...custom, ...sorted];
  }

  setSelectedMode(mode: string) {
    this.selectedMode = mode;
  }

  setOnAirOnly(value: boolean) {
    this.onAirOnly = value;
  }

  setEmergencyOnly(value: boolean) {
    this.emergencyOnly = value;
  }

  /**
   * Load cached data then fetch from API if needed.
   * Safe to call on every screen mount.
   */
  async initialize(): Promise<void> {
    await Promise.all([this.loadFromCache(), this.loadCustomRepeaters()]);
    await this.checkAndFetchIfNeeded();
  }

  /**
   * Load previously cached repeater data from AsyncStorage.
   */
  async loadFromCache(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cache: RepeaterCache = JSON.parse(raw);
      runInAction(() => {
        this.repeaters = cache.repeaters;
        this.queryLat = cache.queryLat;
        this.queryLng = cache.queryLng;
        this.lastUpdated = cache.lastUpdated;
        this.isCachedData = true;
      });
    } catch {
      // Cache read failure is non-fatal; the app will attempt a live fetch.
    }
  }

  /**
   * Load user-created custom repeaters from AsyncStorage.
   */
  async loadCustomRepeaters(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_KEY);
      if (!raw) return;
      const entries: Repeater[] = JSON.parse(raw);
      runInAction(() => {
        this.customRepeaters = entries;
      });
    } catch {
      // Non-fatal; custom repeaters simply won't be shown until a reload.
    }
  }

  /**
   * Persist the current customRepeaters list to AsyncStorage.
   */
  private async saveCustomRepeaters(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CUSTOM_KEY,
        JSON.stringify(this.customRepeaters),
      );
    } catch (error) {
      // Log for diagnostics and rethrow a more descriptive error so callers
      // can react appropriately (e.g., show a message to the user).

      console.error(
        'Failed to persist custom repeaters to AsyncStorage',
        error,
      );
      throw new Error(
        'Unable to save custom repeaters. Changes may not be persisted.',
      );
    }
  }

  /**
   * Add a new user-created repeater entry.
   */
  async addCustomRepeater(
    data: Omit<
      Repeater,
      | 'id'
      | 'isCustom'
      | 'distance'
      | 'lastEdited'
      | 'lat'
      | 'lng'
      | 'use'
      | 'state'
    >,
  ): Promise<void> {
    const entry: Repeater = {
      ...data,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      isCustom: true,
      distance: 0,
      lastEdited: new Date().toISOString().slice(0, 10),
      lat: 0,
      lng: 0,
      use: '',
      state: '',
    };
    runInAction(() => {
      this.customRepeaters = [entry, ...this.customRepeaters];
    });
    await this.saveCustomRepeaters();
  }

  /**
   * Update an existing user-created repeater entry.
   */
  async updateCustomRepeater(
    id: string,
    data: Partial<Repeater>,
  ): Promise<void> {
    runInAction(() => {
      this.customRepeaters = this.customRepeaters.map((r) =>
        r.id === id ? { ...r, ...data } : r,
      );
    });
    await this.saveCustomRepeaters();
  }

  /**
   * Delete a user-created repeater entry.
   */
  async deleteCustomRepeater(id: string): Promise<void> {
    runInAction(() => {
      this.customRepeaters = this.customRepeaters.filter((r) => r.id !== id);
    });
    await this.saveCustomRepeaters();
  }

  /**
   * Compare current location against the cached query location and trigger a
   * fetch when the user has moved more than REFETCH_THRESHOLD_MILES, or when
   * there is no cached data at all.
   *
   * Requests location authorization (whenInUse) before attempting to read the
   * device position, following the same pattern as CoreStore. If authorization
   * is denied or location is unavailable and there is no cached data, sets an
   * error message so the UI can explain the empty state to the user.
   */
  async checkAndFetchIfNeeded(): Promise<void> {
    const auth = await Geolocation.requestAuthorization('whenInUse');
    if (auth !== 'granted') {
      runInAction(() => {
        if (this.repeaters.length === 0) {
          this.error =
            'Location permission denied. Enable location access to load repeaters.';
        }
      });
      return;
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const needsFetch =
            this.queryLat === null ||
            this.queryLng === null ||
            this.repeaters.length === 0 ||
            distanceMiles(latitude, longitude, this.queryLat, this.queryLng) >
              REFETCH_THRESHOLD_MILES;

          if (needsFetch) {
            await this.fetchRepeaters(latitude, longitude);
          }
          resolve();
        },
        () => {
          // Location unavailable – keep cached data if present, otherwise
          // surface an error so the user knows why the list is empty.
          runInAction(() => {
            if (this.repeaters.length === 0) {
              this.error =
                'Unable to determine location. Connect to the internet and enable location access.';
            }
          });
          resolve();
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    });
  }

  /**
   * Fetch repeaters for the user's current state and all neighboring states
   * in parallel. Results are merged, deduplicated by repeater ID, and cached
   * without a distance filter so cached data stays useful after the user moves.
   */
  async fetchRepeaters(lat: number, lng: number): Promise<void> {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      // 1. Determine the user's state from coordinates.
      const currentState = stateFromCoordinates(lat, lng);
      if (!currentState) {
        throw new Error('Location not in a supported region');
      }

      // 2. Build the list of states to query (current + all neighbors).
      const neighbors = NEIGHBORING_STATES[currentState] ?? [];
      const statesToQuery = [currentState, ...neighbors];

      // 3. Fetch all states in parallel; individual state failures are caught
      //    so one bad response doesn't discard all others.
      const settled = await Promise.allSettled(
        statesToQuery.map((state) => fetchStateRepeaters(state)),
      );

      // Collect rows from fulfilled promises.
      const rawRows: Record<string, string>[] = [];
      const failedStates: string[] = [];
      settled.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          rawRows.push(...result.value);
        } else {
          failedStates.push(statesToQuery[i]);
        }
      });

      // If every single request failed, propagate the first error.
      if (
        rawRows.length === 0 &&
        failedStates.length === statesToQuery.length
      ) {
        const firstSettled = settled[0];
        const firstReason =
          firstSettled.status === 'rejected'
            ? firstSettled.reason instanceof Error
              ? firstSettled.reason.message
              : String(firstSettled.reason)
            : 'Unknown error';
        throw new Error(firstReason);
      }

      // 4. Deduplicate by repeater ID (stateId-rptId).
      const seen = new Set<string>();
      const dedupedRows: Record<string, string>[] = [];
      for (const row of rawRows) {
        const id = `${row['State ID'] ?? ''}-${row['Rptr ID'] ?? ''}`;
        if (!seen.has(id)) {
          seen.add(id);
          dedupedRows.push(row);
        }
      }

      // 5. Map to Repeater objects with distances calculated from current pos.
      //    ALL results are kept (no distance filter) so the cache is reusable
      //    as the user moves within the queried region.
      const repeaters = dedupedRows.map((row) => mapRow(row, lat, lng));
      const lastUpdated = new Date().toISOString();

      const cache: RepeaterCache = {
        repeaters,
        queryLat: lat,
        queryLng: lng,
        lastUpdated,
        queriedStates: statesToQuery,
      };

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));

      runInAction(() => {
        this.repeaters = repeaters;
        this.queryLat = lat;
        this.queryLng = lng;
        this.lastUpdated = lastUpdated;
        this.isCachedData = false;
        this.isLoading = false;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      runInAction(() => {
        this.error = `Failed to load repeaters: ${message}`;
        this.isLoading = false;
        // Keep isCachedData true when a fetch fails and we still have cached
        // data from loadFromCache.
      });
    }
  }

  dispose(): void {
    // No-op – nothing to clean up.
  }
}
