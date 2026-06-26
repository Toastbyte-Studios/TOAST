import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  useCurrentPosition,
  type OfflinePack,
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
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { useTheme } from '../../../../hooks/useTheme';
import {
  DEFAULT_OFFLINE_ZOOM,
  HIGH_DETAIL_OFFLINE_ZOOM,
  OfflineMapService,
} from '../../../../navigation/services/OfflineMapService';
import { boundsFromRadius } from '../../../../navigation/utils/boundsFromRadius';
import { boundsToGeoJSON } from '../../../../navigation/utils/boundsToGeoJSON';
import { formatBytes } from '../../../../navigation/utils/formatBytes';
import { useSettingsStore } from '../../../../stores';
import { useOfflineDownloadStore } from '../../../../stores/StoreContext';
import type { OfflineMapPackMetadata } from '../../../../stores/OfflineDownloadStore';

const RETRY_TIMEOUT_MS = 15_000;
const FREE_DISK_BUFFER_BYTES = 500 * 1024 * 1024; // 500 MB safety margin
const RADIUS_MILES = 50;
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type Props = {
  onDismiss: () => void;
};

/**
 * Modal sheet for confirming an offline map download.
 * Navigation: registered as a modal route on AppNavigator;
 * dismiss via onDismiss (which calls navigation.goBack()).
 *
 * The "High detail" toggle is backed by the persisted app setting
 * (`SettingsStore.highDetailOffline`) so the choice carries across downloads
 * and matches the toggle surfaced in Settings.
 */
function DownloadConfirmScreen({ onDismiss }: Props) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const settingsStore = useSettingsStore();
  const fillLayerStyle = useMemo(
    () => ({ fillColor: COLORS.SECONDARY_ACCENT, fillOpacity: 0.2 }),
    [COLORS.SECONDARY_ACCENT],
  );
  const lineLayerStyle = useMemo(
    () => ({ lineColor: COLORS.SECONDARY_ACCENT, lineWidth: 2 }),
    [COLORS.SECONDARY_ACCENT],
  );
  const store = useOfflineDownloadStore();

  const mlPosition = useCurrentPosition();
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highDetail = settingsStore.highDetailOffline;
  const zoomRange = highDetail
    ? HIGH_DETAIL_OFFLINE_ZOOM
    : DEFAULT_OFFLINE_ZOOM;

  const [storagePressure, setStoragePressure] = useState(false);
  const [starting, setStarting] = useState(false);

  // Wait for GPS fix; time out after RETRY_TIMEOUT_MS
  useEffect(() => {
    if (mlPosition && !gpsReady) {
      setGpsReady(true);
      setGpsTimedOut(false);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    }
  }, [mlPosition, gpsReady]);

  const startRetryTimer = useCallback(() => {
    setGpsTimedOut(false);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      if (!mlPosition) setGpsTimedOut(true);
    }, RETRY_TIMEOUT_MS);
  }, [mlPosition]);

  useEffect(() => {
    startRetryTimer();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [startRetryTimer]);

  const coords = mlPosition?.coords;
  const bounds = useMemo(
    () =>
      coords
        ? boundsFromRadius(
            { longitude: coords.longitude, latitude: coords.latitude },
            RADIUS_MILES,
          )
        : null,
    [coords],
  );

  const estimatedBytes = useMemo(
    () =>
      bounds
        ? OfflineMapService.estimateDownloadBytes({ bounds, zoomRange })
        : 0,
    [bounds, zoomRange],
  );

  const boundsGeoJSON = useMemo(
    () => (bounds ? boundsToGeoJSON(bounds) : null),
    [bounds],
  );

  // Storage pressure check whenever estimate changes
  useEffect(() => {
    if (estimatedBytes === 0) return;
    let ignore = false;
    DeviceInfo.getFreeDiskStorage().then((freeBytes) => {
      if (ignore) return;
      setStoragePressure(estimatedBytes > freeBytes - FREE_DISK_BUFFER_BYTES);
    });
    return () => {
      ignore = true;
    };
  }, [estimatedBytes]);

  const handleDownload = useCallback(async () => {
    if (!bounds || !coords || starting) return;
    setStarting(true);
    try {
      const metadata: OfflineMapPackMetadata = {
        name: `Area Download ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        radiusMiles: RADIUS_MILES,
        centerLng: coords.longitude,
        centerLat: coords.latitude,
      };
      const pack = await OfflineMapService.downloadRegion({
        bounds,
        metadata,
        zoomRange,
        onProgress: (p, s) => store.handleProgress(p, s),
        onError: (p, e) => store.handleError(p, e),
      });
      store.start(pack);
      onDismiss();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start download';
      store.handleError({ id: '' } as unknown as OfflinePack, { message: msg });
      onDismiss();
    }
  }, [bounds, coords, zoomRange, store, starting, onDismiss]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Download your area</Text>
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Map preview */}
        <View style={styles.mapContainer}>
          {!gpsReady ? (
            <View style={styles.gpsWaiting}>
              {gpsTimedOut ? (
                <>
                  <Text style={styles.gpsText}>GPS fix timed out</Text>
                  <TouchableOpacity
                    onPress={startRetryTimer}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator color={COLORS.SECONDARY_ACCENT} />
                  <Text style={styles.gpsText}>Waiting for GPS…</Text>
                </>
              )}
            </View>
          ) : (
            <Map
              style={styles.map}
              mapStyle={MAP_STYLE_URL}
              logo={false}
              attribution={false}
            >
              {coords && (
                <Camera
                  initialViewState={{
                    center: [coords.longitude, coords.latitude],
                    zoom: 9,
                  }}
                />
              )}
              {boundsGeoJSON && (
                <GeoJSONSource id="download-bounds" data={boundsGeoJSON}>
                  <Layer
                    id="download-bounds-fill"
                    type="fill"
                    style={fillLayerStyle}
                  />
                  <Layer
                    id="download-bounds-line"
                    type="line"
                    style={lineLayerStyle}
                  />
                </GeoJSONSource>
              )}
            </Map>
          )}
        </View>

        {/* Storage pressure warning */}
        {storagePressure && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ Low storage — this download may not fit. Free up space before
              continuing.
            </Text>
          </View>
        )}

        {/* Detail toggle */}
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>High detail (z8–14)</Text>
            <Text style={styles.hint}>
              Includes building detail. ~2× storage.
            </Text>
          </View>
          <Switch
            value={highDetail}
            onValueChange={(value) =>
              settingsStore.setHighDetailOffline(value)
            }
            trackColor={{ true: COLORS.SECONDARY_ACCENT }}
            accessibilityLabel="Toggle high detail"
          />
        </View>

        {/* Estimate */}
        <View style={styles.estimateRow}>
          <Text style={styles.estimateLabel}>Estimated size</Text>
          <Text style={styles.estimateValue}>
            {gpsReady ? formatBytes(estimatedBytes) : '—'}
          </Text>
        </View>

        <Text style={styles.radiusNote}>
          Covers a ~{RADIUS_MILES}-mile radius around your current location ·
          works in airplane mode
        </Text>

        {/* Download button */}
        <TouchableOpacity
          style={[
            styles.downloadBtn,
            { backgroundColor: COLORS.SECONDARY_ACCENT },
            (!gpsReady || starting) && styles.downloadBtnDisabled,
          ]}
          onPress={handleDownload}
          disabled={!gpsReady || starting}
          accessibilityLabel="Start download"
          accessibilityRole="button"
        >
          {starting ? (
            <ActivityIndicator color={COLORS.PRIMARY_LIGHT} />
          ) : (
            <Text
              style={[styles.downloadBtnText, { color: COLORS.PRIMARY_LIGHT }]}
            >
              Download
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default observer(DownloadConfirmScreen);

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.BACKGROUND,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.SECONDARY_ACCENT,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.PRIMARY_DARK,
    },
    cancelText: {
      fontSize: 15,
      color: colors.SECONDARY_ACCENT,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      gap: 16,
    },
    mapContainer: {
      height: 220,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.SECONDARY_ACCENT,
    },
    map: {
      flex: 1,
    },
    gpsWaiting: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    gpsText: {
      fontSize: 14,
      color: colors.PRIMARY_DARK,
    },
    retryText: {
      fontSize: 14,
      color: colors.SECONDARY_ACCENT,
      fontWeight: '600',
    },
    warningBanner: {
      backgroundColor: '#FFF3CD',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: '#FFCA2C',
    },
    warningText: {
      fontSize: 13,
      color: '#664D03',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    rowLabel: {
      flex: 1,
      marginRight: 12,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.PRIMARY_DARK,
    },
    hint: {
      fontSize: 12,
      color: colors.SECONDARY_ACCENT,
      marginTop: 2,
    },
    estimateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    estimateLabel: {
      fontSize: 15,
      color: colors.PRIMARY_DARK,
    },
    estimateValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.PRIMARY_DARK,
    },
    radiusNote: {
      fontSize: 12,
      color: colors.SECONDARY_ACCENT,
      textAlign: 'center',
    },
    downloadBtn: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    downloadBtnDisabled: {
      opacity: 0.5,
    },
    downloadBtnText: {
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
