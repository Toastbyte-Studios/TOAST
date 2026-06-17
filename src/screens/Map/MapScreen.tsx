/**
 * MapScreen - Native map with GPS location tracking and compass
 * Uses MapLibre (@maplibre/maplibre-react-native) for vector tile rendering
 * with OpenFreeMap style tiles, GPS tracking, compass, and camera-based
 * map navigation control.
 * @format
 */

import {
  LocationManager,
  type CameraRef,
  useCurrentPosition,
} from '@maplibre/maplibre-react-native';
import { observer } from 'mobx-react-lite';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import CompassHeading from 'react-native-compass-heading';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useGestureNavigation } from '../../navigation/NavigationHistoryContext';
import {
  useTrackStore,
  useWaypointStore,
  useSettingsStore,
} from '../../stores/StoreContext';
import { Track, TrackPoint } from '../../stores/TrackStore';
import { FOOTER_HEIGHT } from '../../theme';
import CompassDataPanel from './components/CompassDataPanel';
import CompassRing from './components/CompassRing';
import MapPanel, {
  DELTA,
  LocationPermissionStatus,
  RecordingState,
  zoomFromDelta,
} from './components/MapPanel';
import WaypointBottomSheet from './components/WaypointBottomSheet';
import { haversineMeters } from './components/WaypointBottomSheet/waypointGeometry';
import { requestForegroundNotificationPermission } from './requestForegroundNotificationPermission';

// US state name → 2-letter abbreviation
const US_STATE_ABBR: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
};

const NOMINATIM_USER_AGENT =
  'TOAST Survival App (toastbyte.studio, support@toastbyte.studio)';

/**
 * Reverse geocodes a lat/lng via Nominatim and calls setName with the result.
 * Falls back to county/country, then '--' on any error.
 * Pass an AbortSignal to cancel an in-flight request (e.g. on unmount or new position).
 */
async function fetchLocationName(
  lat: number,
  lng: number,
  setName: (name: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        signal,
        headers: {
          'Accept-Language': 'en',
          'User-Agent': NOMINATIM_USER_AGENT,
        },
      },
    );
    if (!resp.ok) {
      setName('--');
      return;
    }
    const data = await resp.json();
    const addr = data?.address;
    if (!addr) {
      setName('--');
      return;
    }
    const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? null;
    const state: string | undefined = addr.state;
    const county: string | undefined = addr.county;
    const country: string | undefined = addr.country;
    if (city && state) {
      const abbr = US_STATE_ABBR[state] ?? state;
      setName(`${city}, ${abbr}`);
    } else if (county && country) {
      setName(`${county}, ${country}`);
    } else if (country) {
      setName(country);
    } else {
      setName('--');
    }
  } catch (err: unknown) {
    // Ignore AbortError — request was intentionally cancelled
    if (err instanceof Error && err.name === 'AbortError') {
      return;
    }
    setName('--');
  }
}

/**
 * Requests foreground location permission on the current platform.
 * Uses LocationManager.requestPermissions() — unified for iOS and Android.
 * Returns 'granted' | 'denied'.
 */
async function requestLocationPermission(): Promise<'granted' | 'denied'> {
  try {
    const granted = await LocationManager.requestPermissions();
    return granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Upgrades iOS location authorization to 'always' so GPS callbacks continue
 * when the screen is locked during trail recording.
 * On Android 10+ (API 29+) requests ACCESS_BACKGROUND_LOCATION, directing
 * the user to Settings on Android 11+ where runtime granting isn't allowed.
 */
async function requestBackgroundLocationPermission(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.requestAuthorization('always');
      if (status !== 'granted') {
        Alert.alert(
          'Background Location',
          'To keep recording while the screen is locked, allow "Always" location access in Settings → Privacy → Location Services → TOAST.',
          [{ text: 'OK' }],
        );
      }
      return;
    }

    // Android 10+ requires ACCESS_BACKGROUND_LOCATION separately
    if (Platform.OS === 'android' && Number(Platform.Version) >= 29) {
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      );
      if (already) {
        return;
      }
      // Android 11+ (API 30+) must be granted via Settings; runtime dialog not available
      if (Number(Platform.Version) >= 30) {
        Alert.alert(
          'Background Location',
          'To keep recording while the screen is locked, go to Settings → Apps → TOAST → Permissions → Location → Allow all the time.',
          [{ text: 'OK' }],
        );
        return;
      }
      // Android 10 (API 29) can request at runtime
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Background Location',
          message:
            'Allow TOAST to access location in the background so your GPS trail continues recording when the screen is locked.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        },
      );
    }
  } catch {
    // Non-fatal — recording still works in foreground
  }
}

/** Starts the Android foreground service that keeps GPS alive in background.
 * Waits for Android 13+ notification permission flow, then starts native service. */
async function startAndroidForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    await requestForegroundNotificationPermission();
    // The native module method is void; we intentionally don't await anything.

    NativeModules.LocationForegroundService?.start?.();
  } catch {
    // Non-fatal — recording still works; may stop when backgrounded
  }
}

/** Stops the Android foreground service.
 * Fire-and-forget — the native method is void and no response is needed. */
function stopAndroidForegroundService(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    // The native module method is void; we intentionally don't await anything.

    NativeModules.LocationForegroundService?.stop?.();
  } catch {
    // Non-fatal
  }
}

/**
 * MapScreen renders the platform's native map (MapKit on iOS,
 * Google Maps on Android) with a live GPS blue-dot and a
 * CLLocationManager-driven compass below the map.
 */

/** Duration in ms for map region animation. */
const MAP_ANIMATE_DURATION_MS = 400;
/** Number of GPS points between polyline state updates during recording (performance optimisation). */
const POLYLINE_UPDATE_INTERVAL = 3;
/** Minimum coordinate delta (~100 m) before triggering a new reverse-geocode request. */
const GEOCODE_THRESHOLD = 0.001;

export default observer(function MapScreen() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { setDisableGestureNavigation } = useGestureNavigation();
  const cameraRef = useRef<CameraRef>(null);
  const waypointStore = useWaypointStore();
  const trackStore = useTrackStore();
  const settingsStore = useSettingsStore();
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('undetermined');
  const [locationReady, setLocationReady] = useState(false);
  const [heading, setHeading] = useState(0);
  const needleRotation = useRef(new Animated.Value(0)).current;
  const lastHeading = useRef(0);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    altitude: number | null;
  } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  // watchIdRef tracks the Geolocation watch used exclusively during track recording.
  const watchIdRef = useRef<number | null>(null);
  // Holds the AbortController for the in-flight Nominatim request
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const [waypointSheetOpen, setWaypointSheetOpen] = useState(false);
  // Measured height of the map container — used to keep the sheet within map bounds.
  const [mapContainerHeight, setMapContainerHeight] = useState(0);

  // ── Recording state ────────────────────────────────────────────────────────
  /** Mutable ref so GPS callback closure always reads the latest value. */
  const recordingStateRef = useRef<RecordingState>('idle');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const recordedPointsRef = useRef<TrackPoint[]>([]);
  /** Incremental distance accumulator — avoids O(n²) recomputation on each GPS update. */
  const recordingDistanceRef = useRef(0);
  const [recordingPolylineCoords, setRecordingPolylineCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingDistance, setRecordingDistance] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** The currently viewed saved track overlay (read-only polyline). */
  const [viewedTrack, setViewedTrack] = useState<Track | null>(null);
  /** Mirrors permissionStatus state so AppState callback can read it without deps. */
  const permissionStatusRef = useRef<LocationPermissionStatus>('undetermined');
  // ──────────────────────────────────────────────────────────────────────────

  // Live GPS position from MapLibre LocationManager — drives coords display and locate-me.
  const mlPosition = useCurrentPosition();

  // Disable swipe-back while map is active (conflicts with map panning)
  useEffect(() => {
    setDisableGestureNavigation(true);
    return () => setDisableGestureNavigation(false);
  }, [setDisableGestureNavigation]);

  // Request location permission via LocationManager (unified iOS + Android)
  useEffect(() => {
    requestLocationPermission().then((status) => {
      setPermissionStatus(status);
      setLocationReady(true);
    });
  }, []);

  // Keep permissionStatusRef in sync so AppState callback can read it.
  useEffect(() => {
    permissionStatusRef.current = permissionStatus;
  }, [permissionStatus]);

  // Subscribe to CLLocationManager heading (tilt-compensated, same as native compass)
  useEffect(() => {
    type HeadingData = { heading: number; accuracy: number };
    // Degree threshold before a heading update is fired (1° = smooth)
    CompassHeading.start(1, ({ heading: newHeading }: HeadingData) => {
      // Always take the shortest arc to avoid spinning past 360°
      let delta = newHeading - lastHeading.current;
      if (delta > 180) {
        delta -= 360;
      }
      if (delta < -180) {
        delta += 360;
      }
      const smoothed = lastHeading.current + delta;
      lastHeading.current = smoothed;

      setHeading(Math.round(newHeading));
      Animated.spring(needleRotation, {
        toValue: smoothed,
        useNativeDriver: true,
        speed: 20,
        bounciness: 0,
      }).start();
    });
    return () => CompassHeading.stop();
  }, [needleRotation]);

  // Drive coords and geocoding from MapLibre's useCurrentPosition hook.
  // This replaces the previous Geolocation.watchPosition for non-recording use.
  const lastGeocodedLatRef = useRef<number | null>(null);
  const lastGeocodedLngRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mlPosition) {
      return;
    }
    const { latitude, longitude, altitude } = mlPosition.coords;
    setCoords({ latitude, longitude, altitude: altitude ?? null });

    // Only reverse-geocode when position has moved meaningfully
    if (
      lastGeocodedLatRef.current === null ||
      lastGeocodedLngRef.current === null ||
      Math.abs(latitude - lastGeocodedLatRef.current) > GEOCODE_THRESHOLD ||
      Math.abs(longitude - lastGeocodedLngRef.current) > GEOCODE_THRESHOLD
    ) {
      lastGeocodedLatRef.current = latitude;
      lastGeocodedLngRef.current = longitude;
      geocodeAbortRef.current?.abort();
      geocodeAbortRef.current = new AbortController();
      fetchLocationName(
        latitude,
        longitude,
        setLocationName,
        geocodeAbortRef.current.signal,
      );
    }
  }, [mlPosition]);

  // Cancel any in-flight geocode request on unmount
  useEffect(() => {
    return () => {
      geocodeAbortRef.current?.abort();
      geocodeAbortRef.current = null;
    };
  }, []);

  // Clean up recording timer on unmount; stop foreground service if still running
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      // Stop recording watch and foreground service if component unmounts mid-recording
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      stopAndroidForegroundService();
    };
  }, []);

  // AppState listener: resync the HUD elapsed timer after returning from background
  // while a track recording is in progress.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          nextState === 'active' &&
          recordingStateRef.current === 'recording' &&
          recordingStartTimeRef.current !== null
        ) {
          setRecordingElapsed(
            Math.floor((Date.now() - recordingStartTimeRef.current) / 1000),
          );
        }
      },
    );
    return () => subscription.remove();
  }, []);

  const handleLocateMe = () => {
    if (!cameraRef.current || permissionStatus === 'denied' || !mlPosition) {
      return;
    }
    cameraRef.current.setStop({
      center: [mlPosition.coords.longitude, mlPosition.coords.latitude],
      zoom: zoomFromDelta(DELTA.latitudeDelta),
      duration: 300,
      easing: 'fly',
    });
  };

  const handleAddWaypointFromLocation = useCallback(
    async (name: string) => {
      if (!coords) {
        return;
      }
      await waypointStore.addWaypoint(name, coords.latitude, coords.longitude);
    },
    [coords, waypointStore],
  );

  const handleAddWaypointManual = useCallback(
    async (name: string, latitude: number, longitude: number) => {
      await waypointStore.addWaypoint(name, latitude, longitude);
    },
    [waypointStore],
  );

  const handleNavigateWaypoint = useCallback(
    (id: string) => {
      waypointStore.setActiveWaypoint(id);
      setWaypointSheetOpen(false);
      // Pan the map to centre on the selected waypoint
      const waypoint = waypointStore.waypoints.find((w) => w.id === id);
      if (waypoint && cameraRef.current) {
        cameraRef.current.setStop({
          center: [waypoint.longitude, waypoint.latitude],
          zoom: zoomFromDelta(DELTA.latitudeDelta),
          duration: MAP_ANIMATE_DURATION_MS,
          easing: 'fly',
        });
      }
    },
    [waypointStore],
  );

  const handleDeleteWaypoint = useCallback(
    async (id: string) => {
      await waypointStore.deleteWaypoint(id);
    },
    [waypointStore],
  );

  const handleLongPressMap = useCallback(
    async (coordinate: { latitude: number; longitude: number }) => {
      // Find the next unused "Waypoint N" number (handles gaps from deletions)
      const existing = new Set(waypointStore.waypoints.map((w) => w.name));
      let n = waypointStore.waypoints.length + 1;
      while (existing.has(`Waypoint ${n}`)) {
        n++;
      }
      await waypointStore.addWaypoint(
        `Waypoint ${n}`,
        coordinate.latitude,
        coordinate.longitude,
      );
      setWaypointSheetOpen(true);
    },
    [waypointStore],
  );

  // ── Recording handlers ────────────────────────────────────────────────────

  const handleRecordPress = useCallback(() => {
    if (recordingStateRef.current === 'idle') {
      // Request background location permission so GPS continues when screen locks.
      // Non-blocking — recording starts immediately; the permission prompt is async.
      requestBackgroundLocationPermission();
      // On Android, start the foreground service before GPS sampling begins so
      // the OS doesn't kill the process when the screen is locked.
      startAndroidForegroundService();
      // Start recording
      recordedPointsRef.current = [];
      recordingDistanceRef.current = 0;
      recordingStartTimeRef.current = Date.now();
      recordingStateRef.current = 'recording';
      setRecordingState('recording');
      setRecordingElapsed(0);
      setRecordingDistance(0);
      setRecordingPolylineCoords([]);
      recordingTimerRef.current = setInterval(() => {
        if (recordingStartTimeRef.current !== null) {
          setRecordingElapsed(
            Math.floor((Date.now() - recordingStartTimeRef.current) / 1000),
          );
        }
      }, 1000);
      // Start a dedicated GPS watch for recording track-point accumulation.
      // Uses Geolocation.watchPosition so the foreground service keeps GPS alive
      // in background (the callback-based approach survives screen-lock on Android).
      watchIdRef.current = Geolocation.watchPosition(
        (pos: GeoPosition) => {
          if (recordingStateRef.current !== 'recording') {
            return;
          }
          const { latitude, longitude, altitude } = pos.coords;
          const point: TrackPoint = {
            latitude,
            longitude,
            altitude: altitude ?? null,
            timestamp: Date.now(),
          };
          recordedPointsRef.current.push(point);
          const pts = recordedPointsRef.current;
          // Accumulate distance incrementally (O(1) per point)
          if (pts.length > 1) {
            const prev = pts[pts.length - 2];
            recordingDistanceRef.current += haversineMeters(
              prev.latitude,
              prev.longitude,
              point.latitude,
              point.longitude,
            );
          }
          // Batch polyline updates to avoid excessive re-renders
          if (pts.length % POLYLINE_UPDATE_INTERVAL === 0 || pts.length === 1) {
            setRecordingPolylineCoords(
              pts.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              })),
            );
            setRecordingDistance(recordingDistanceRef.current);
          }
        },
        (err) => {
          console.warn('MapScreen recording watchPosition error:', err.message);
        },
        { enableHighAccuracy: true, distanceFilter: 5 },
      );
    } else if (recordingStateRef.current === 'recording') {
      // Stop recording — transition to 'stopped' to show Save/Discard UI
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      stopAndroidForegroundService();
      recordingStateRef.current = 'stopped';
      setRecordingState('stopped');
      // Final polyline update
      const pts = recordedPointsRef.current;
      setRecordingPolylineCoords(
        pts.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      );
      setRecordingDistance(recordingDistanceRef.current);
    }
  }, []);

  const handleSaveTrack = useCallback(
    async (name: string) => {
      const pts = recordedPointsRef.current;
      const elapsed = recordingElapsed;
      const dist = recordingDistanceRef.current;
      const savedTrack = await trackStore.saveTrack(name, elapsed, dist, pts);
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      stopAndroidForegroundService();
      // Reset recording state
      recordingStateRef.current = 'idle';
      setRecordingState('idle');
      setRecordingPolylineCoords([]);
      setRecordingElapsed(0);
      setRecordingDistance(0);
      recordedPointsRef.current = [];
      recordingDistanceRef.current = 0;
      // Show the newly saved track on the map
      setViewedTrack(savedTrack);
    },
    [trackStore, recordingElapsed],
  );

  const handleDiscardTrack = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    stopAndroidForegroundService();
    recordingStateRef.current = 'idle';
    setRecordingState('idle');
    setRecordingPolylineCoords([]);
    setRecordingElapsed(0);
    setRecordingDistance(0);
    recordedPointsRef.current = [];
    recordingDistanceRef.current = 0;
  }, []);

  const handleViewTrack = useCallback((track: Track) => {
    setViewedTrack(track);
    setWaypointSheetOpen(false);
    // Pan map to first point of track
    if (track.points.length > 0 && cameraRef.current) {
      cameraRef.current.setStop({
        center: [track.points[0].longitude, track.points[0].latitude],
        zoom: zoomFromDelta(DELTA.latitudeDelta),
        duration: MAP_ANIMATE_DURATION_MS,
        easing: 'fly',
      });
    }
  }, []);

  const handleDeleteTrack = useCallback(
    async (id: string) => {
      await trackStore.deleteTrack(id);
      if (viewedTrack?.id === id) {
        setViewedTrack(null);
      }
    },
    [trackStore, viewedTrack],
  );

  // ─────────────────────────────────────────────────────────────────────────

  // Ring rotates opposite to heading so the needle appears fixed pointing up
  const ringSpin = needleRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '-360deg'],
  });
  // Counter-rotation keeps each cardinal label upright as the ring spins
  const labelSpin = needleRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const viewedTrackCoords = viewedTrack
    ? viewedTrack.points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }))
    : [];

  return (
    <ScreenBody>
      <SectionHeader>Map</SectionHeader>
      <View style={styles.wrapper}>
        {/* Map — outer view owns sizing/sheet; inner view clips map tiles to rounded corners */}
        <View
          style={styles.mapWrapper}
          onLayout={(e) => setMapContainerHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.mapInner}>
            <MapPanel
              permissionStatus={permissionStatus}
              locationReady={locationReady}
              cameraRef={cameraRef}
              onLocateMe={handleLocateMe}
              onWaypointsPress={() => setWaypointSheetOpen(true)}
              onLongPressMap={handleLongPressMap}
              waypoints={waypointStore.waypoints}
              activeWaypointId={waypointStore.activeWaypointId}
              recordingState={recordingState}
              onRecordPress={handleRecordPress}
              recordingPolylineCoords={recordingPolylineCoords}
              viewedTrackCoords={viewedTrackCoords}
              recordingElapsed={recordingElapsed}
              recordingDistance={recordingDistance}
              measurementSystem={settingsStore.measurementSystem}
              onSaveTrack={handleSaveTrack}
              onDiscardTrack={handleDiscardTrack}
            />
          </View>
          {/* Waypoint bottom sheet — positioned absolutely within the map area */}
          <WaypointBottomSheet
            waypoints={waypointStore.waypoints}
            tracks={trackStore.tracks}
            currentCoords={coords}
            isOpen={waypointSheetOpen}
            onClose={() => setWaypointSheetOpen(false)}
            onNavigate={handleNavigateWaypoint}
            onDelete={handleDeleteWaypoint}
            onAddFromLocation={handleAddWaypointFromLocation}
            onAddManual={handleAddWaypointManual}
            containerHeight={mapContainerHeight}
            onViewTrack={handleViewTrack}
            onDeleteTrack={handleDeleteTrack}
          />
        </View>

        {/* Compass */}
        <View style={styles.compassContainer}>
          <CompassRing ringSpin={ringSpin} labelSpin={labelSpin} />
          <CompassDataPanel
            heading={heading}
            coords={coords}
            locationName={locationName}
          />
        </View>
      </View>
    </ScreenBody>
  );
});

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      paddingBottom: FOOTER_HEIGHT,
      gap: 5,
    },
    mapWrapper: {
      width: '90%',
      flex: 1,
      marginTop: 5,
      overflow: 'hidden',
    },
    mapInner: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.SECONDARY_ACCENT,
      overflow: 'hidden',
    },
    compassContainer: {
      width: '90%',
      height: 140,
      marginBottom: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.SECONDARY_ACCENT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
    },
  });
}
