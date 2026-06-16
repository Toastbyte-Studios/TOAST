import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { Waypoint } from '../../../stores/WaypointStore';
import { formatDistance } from './WaypointBottomSheet/waypointGeometry';
import type { MeasurementSystem } from '../../../stores/SettingsStore';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';

export const DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };

/**
 * Converts a react-native-maps-style latitudeDelta to a MapLibre zoom level.
 * Formula: zoom = log2(360 / latitudeDelta)
 */
export function zoomFromDelta(latitudeDelta: number): number {
  return Math.round(Math.log2(360 / latitudeDelta));
}

export type RecordingState = 'idle' | 'recording' | 'stopped';

type LatLng = { latitude: number; longitude: number };

type Props = {
  permissionStatus: LocationPermissionStatus;
  locationReady: boolean;
  cameraRef: React.RefObject<CameraRef | null>;
  onLocateMe: () => void;
  onWaypointsPress: () => void;
  onLongPressMap?: (coordinate: {
    latitude: number;
    longitude: number;
  }) => void;
  waypoints?: Waypoint[];
  activeWaypointId?: string | null;
  recordingState?: RecordingState;
  onRecordPress?: () => void;
  recordingPolylineCoords?: LatLng[];
  viewedTrackCoords?: LatLng[];
  recordingElapsed?: number;
  recordingDistance?: number;
  measurementSystem?: MeasurementSystem;
  onSaveTrack?: (name: string) => void;
  onDiscardTrack?: () => void;
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

export default function MapPanel({
  permissionStatus,
  locationReady,
  cameraRef,
  onLocateMe,
  onWaypointsPress,
  onLongPressMap,
  waypoints = [],
  activeWaypointId = null,
  recordingState = 'idle',
  onRecordPress,
  recordingPolylineCoords = [],
  viewedTrackCoords = [],
  recordingElapsed = 0,
  recordingDistance = 0,
  measurementSystem = 'metric',
  onSaveTrack,
  onDiscardTrack,
}: Props) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (recordingState === 'recording') {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [recordingState, pulseAnim]);

  const [saveName, setSaveName] = useState('');

  React.useEffect(() => {
    if (recordingState === 'stopped') {
      setSaveName('');
    }
  }, [recordingState]);

  const handleSave = () => {
    onSaveTrack?.(saveName);
    setSaveName('');
  };

  const handleDiscard = () => {
    setSaveName('');
    onDiscardTrack?.();
  };

  return (
    <View style={styles.mapContainer}>
      {!locationReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.SECONDARY_ACCENT} />
          <Text style={styles.loadingText}>Requesting location…</Text>
        </View>
      ) : (
        <>
          {permissionStatus === 'denied' && (
            <View style={styles.deniedBanner}>
              <Text style={styles.deniedText}>
                Location access denied — enable it in Settings to see your
                position.
              </Text>
            </View>
          )}
          <Map
            style={styles.map}
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
            compass
            onDidFinishLoadingMap={
              permissionStatus === 'granted' ? onLocateMe : undefined
            }
            onLongPress={(event) => {
              const [lng, lat] = event.nativeEvent.lngLat;
              onLongPressMap?.({ latitude: lat, longitude: lng });
            }}
          >
            <Camera
              ref={cameraRef}
              initialViewState={{
                center: [0, 0],
                zoom: zoomFromDelta(DELTA.latitudeDelta),
              }}
            />
            {waypoints.map((wp) => (
              <Marker
                key={wp.id}
                id={wp.id}
                lngLat={[wp.longitude, wp.latitude]}
              >
                <View
                  style={[
                    styles.markerDot,
                    wp.id === activeWaypointId && styles.markerDotActive,
                  ]}
                  accessibilityLabel={`Waypoint: ${wp.name}`}
                />
              </Marker>
            ))}
            {viewedTrackCoords.length > 1 && (
              <GeoJSONSource
                id="viewed-track"
                data={{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: viewedTrackCoords.map((c) => [
                      c.longitude,
                      c.latitude,
                    ]),
                  },
                  properties: {},
                }}
              >
                <Layer
                  id="viewed-track-layer"
                  type="line"
                  style={styles.viewedTrackLineStyle}
                />
              </GeoJSONSource>
            )}
            {recordingPolylineCoords.length > 1 && (
              <GeoJSONSource
                id="recording-track"
                data={{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: recordingPolylineCoords.map((c) => [
                      c.longitude,
                      c.latitude,
                    ]),
                  },
                  properties: {},
                }}
              >
                <Layer
                  id="recording-track-layer"
                  type="line"
                  style={styles.recordingLineStyle}
                />
              </GeoJSONSource>
            )}
          </Map>

          {recordingState === 'recording' && (
            <View style={styles.hud}>
              <Text style={styles.hudText}>
                ⏱ {formatElapsed(recordingElapsed)}
                {'   '}📍 {formatDistance(recordingDistance, measurementSystem)}
              </Text>
            </View>
          )}

          {recordingState === 'stopped' && (
            <View style={styles.saveToolbar}>
              <TextInput
                style={styles.saveNameInput}
                placeholder="Track name (optional)"
                placeholderTextColor={COLORS.SECONDARY_ACCENT}
                value={saveName}
                onChangeText={setSaveName}
                accessibilityLabel="Track name input"
              />
              <TouchableOpacity
                style={[styles.saveToolbarBtn, styles.saveBtn]}
                onPress={handleSave}
                accessibilityLabel="Save track"
                accessibilityRole="button"
              >
                <Text style={styles.saveToolbarBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveToolbarBtn, styles.discardBtn]}
                onPress={handleDiscard}
                accessibilityLabel="Discard track"
                accessibilityRole="button"
              >
                <Text style={styles.saveToolbarBtnText}>Discard</Text>
              </TouchableOpacity>
            </View>
          )}

          {permissionStatus === 'granted' && (
            <>
              <TouchableOpacity
                style={styles.waypointsButton}
                onPress={onWaypointsPress}
                activeOpacity={0.8}
                accessibilityLabel="Open waypoints"
                accessibilityRole="button"
              >
                <Text style={styles.waypointsText}>⚑</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.recordButton,
                  recordingState === 'recording' && styles.recordButtonActive,
                  recordingState === 'stopped' && styles.recordButtonDisabled,
                ]}
                onPress={
                  recordingState !== 'stopped' ? onRecordPress : undefined
                }
                activeOpacity={0.8}
                disabled={recordingState === 'stopped'}
                accessibilityLabel={
                  recordingState === 'recording'
                    ? 'Stop recording'
                    : 'Start recording'
                }
                accessibilityRole="button"
              >
                <Animated.Text
                  style={[
                    styles.recordText,
                    recordingState === 'recording' && { opacity: pulseAnim },
                  ]}
                >
                  {recordingState === 'recording' ? '⏹' : '⏺'}
                </Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.locateMeButton}
                onPress={onLocateMe}
                activeOpacity={0.8}
                accessibilityLabel="Center map on my location"
                accessibilityRole="button"
              >
                <Text style={styles.locateMeText}>⌖</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  const rnStyles = StyleSheet.create({
    mapContainer: {
      width: '100%',
      flex: 1,
      overflow: 'hidden',
    },
    map: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.PRIMARY_DARK,
    },
    deniedBanner: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.ERROR,
    },
    deniedText: {
      fontSize: 13,
      textAlign: 'center',
      color: colors.PRIMARY_LIGHT,
    },
    hud: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    hudText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    saveToolbar: {
      position: 'absolute',
      top: 12,
      left: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.BACKGROUND,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.SECONDARY_ACCENT,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    saveNameInput: {
      flex: 1,
      fontSize: 13,
      color: colors.PRIMARY_DARK,
      paddingVertical: 4,
    },
    saveToolbarBtn: {
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    saveBtn: {
      backgroundColor: colors.SECONDARY_ACCENT,
    },
    discardBtn: {
      backgroundColor: colors.ERROR,
    },
    saveToolbarBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.PRIMARY_LIGHT,
    },
    locateMeButton: {
      position: 'absolute',
      bottom: 24,
      right: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      backgroundColor: colors.SECONDARY_ACCENT,
    },
    locateMeText: {
      fontSize: 24,
      lineHeight: 28,
      color: colors.PRIMARY_LIGHT,
    },
    recordButton: {
      position: 'absolute',
      bottom: 24,
      alignSelf: 'center',
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      backgroundColor: colors.SECONDARY_ACCENT,
    },
    recordButtonActive: {
      backgroundColor: '#FF3B30',
    },
    recordButtonDisabled: {
      opacity: 0.4,
    },
    recordText: {
      fontSize: 20,
      lineHeight: 24,
      color: colors.PRIMARY_LIGHT,
    },
    waypointsButton: {
      position: 'absolute',
      bottom: 24,
      left: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      backgroundColor: colors.SECONDARY_ACCENT,
    },
    waypointsText: {
      fontSize: 22,
      lineHeight: 26,
      color: colors.PRIMARY_LIGHT,
    },
    markerDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.SECONDARY_ACCENT,
      borderWidth: 2,
      borderColor: colors.PRIMARY_LIGHT,
    },
    markerDotActive: {
      backgroundColor: colors.ERROR,
    },
  });
  return {
    ...rnStyles,
    /** MapLibre paint style for the viewed (saved) track polyline. */
    viewedTrackLineStyle: { lineColor: colors.SECONDARY_ACCENT, lineWidth: 3 },
    /** MapLibre paint style for the active recording polyline. */
    recordingLineStyle: { lineColor: colors.ERROR, lineWidth: 3 },
  };
}
