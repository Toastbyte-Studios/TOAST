import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  PermissionsAndroid,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import Sound, { type RecordBackType } from 'react-native-nitro-sound';
import AppButton from '../../components/AppButton';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useSignalingStore } from '../../stores/StoreContext';
import { FOOTER_HEIGHT, SCROLL_PADDING } from '../../theme';

// Track if recording is active globally
let isGlobalRecording = false;

/**
 * DecibelMeterScreen component
 *
 * Displays a visual decibel meter that measures ambient sound levels.
 * When active, the meter is also displayed in the footer.
 *
 * Features:
 * - Real-time audio level monitoring
 * - Visual meter display with color gradients
 * - Start/Stop controls
 * - Footer integration when active
 * - Light and dark mode support
 *
 * @returns A React element rendering the decibel meter screen.
 */
const DecibelMeterScreenImpl = () => {
  const core = useSignalingStore();
  const COLORS = useTheme();
  const [isActive, setIsActive] = useState(core.decibelMeterActive);
  const [decibelLevel, setDecibelLevel] = useState(0);
  const animatedLevel = useRef(new Animated.Value(0)).current;

  /**
   * Request audio recording permission for Android.
   * iOS permissions are handled via Info.plist.
   */
  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return true; // iOS permissions handled by Info.plist
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message:
            'This app needs access to your microphone to measure sound levels.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  /**
   * Starts audio recording with real-time metering to get actual dB levels.
   * Uses react-native-audio-recorder-player which exposes currentMetering.
   */
  const startMonitoring = useCallback(async () => {
    if (isGlobalRecording) {
      // Already recording globally, just return
      return;
    }

    try {
      isGlobalRecording = true;

      // Start recording with metering enabled
      await Sound.startRecorder(undefined, undefined, true);

      // Set up the recorder state listener to get real-time metering data
      Sound.addRecordBackListener((e: RecordBackType) => {
        if (!isGlobalRecording) return;

        // currentMetering provides actual dB levels from the microphone
        // On iOS: ranges from -160 dB (silence) to 0 dB (max)
        // On Android: provides amplitude value that we normalize
        const metering = e.currentMetering || -160;

        // Convert metering to a 0-100 scale for display with adjusted sensitivity
        // Sensitivity set to 75% of original (halfway between 100% and 50%)
        let normalizedLevel;
        if (Platform.OS === 'ios') {
          // iOS: -160 to 0 dB range
          // Apply adjusted mapping: use -80 to -10 dB range mapped to 0-100, then scale to 75%
          const adjustedMetering = Math.max(-80, Math.min(-10, metering));
          normalizedLevel = ((adjustedMetering + 80) / 70) * 75; // 75% sensitivity (halfway between 100 and 50)
        } else {
          // Android: amplitude value, normalize to 0-100
          // Reduce sensitivity by scaling the divisor to 75% level
          const adjustedAmplitude = Math.min(metering, 16000); // Cap at half max
          normalizedLevel = adjustedAmplitude / 240; // 75% sensitivity (halfway between 160 and 320)
        }

        // Clamp to 0-100 range
        normalizedLevel = Math.max(0, Math.min(100, normalizedLevel));

        // Update core store so footer can display the level
        core.setCurrentDecibelLevel(normalizedLevel);
      });
    } catch (error) {
      console.error('Error starting monitoring:', error);
      isGlobalRecording = false;
      throw error;
    }
  }, [core]);

  /**
   * Stops audio level monitoring by stopping the recorder.
   */
  const stopMonitoring = useCallback(async () => {
    if (!isGlobalRecording) return;

    try {
      await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      // Only reset the flag after successful operations
      isGlobalRecording = false;
      core.setCurrentDecibelLevel(0);
    } catch (error) {
      console.error('Error stopping recorder:', error);
      // On error, still try to reset state to avoid stuck state
      isGlobalRecording = false;
      core.setCurrentDecibelLevel(0);
    }
  }, [core]);

  /**
   * Handles starting the decibel meter with real microphone input.
   */
  const handleStart = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Microphone permission is required to measure sound levels.',
      );
      return;
    }

    try {
      setIsActive(true);
      core.setDecibelMeterActive(true);
      await startMonitoring();
    } catch (error) {
      console.error('Error starting recorder:', error);
      Alert.alert('Error', 'Failed to start audio monitoring.');
      setIsActive(false);
      core.setDecibelMeterActive(false);
    }
  };

  /**
   * Handles stopping the decibel meter.
   */
  const handleStop = async () => {
    setIsActive(false);
    core.setDecibelMeterActive(false);
    await stopMonitoring();
  };

  /**
   * Sync local decibel level with core store for animation
   */
  useEffect(() => {
    setDecibelLevel(core.currentDecibelLevel);
    Animated.spring(animatedLevel, {
      toValue: core.currentDecibelLevel,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [core.currentDecibelLevel, animatedLevel]);

  /**
   * Cleanup on unmount - DON'T stop the recorder, it should persist globally
   */
  useEffect(() => {
    return () => {
      // Don't stop the recorder on unmount - it should persist across screens
      // The recorder will only stop when the user explicitly stops the meter
    };
  }, []);

  /**
   * Sync local state with core store and start/stop monitoring based on active state.
   */
  useEffect(() => {
    setIsActive(core.decibelMeterActive);

    // If the meter is active but not recording, start it
    if (core.decibelMeterActive && !isGlobalRecording) {
      startMonitoring().catch((error) => {
        console.error('Error starting recorder:', error);
        core.setDecibelMeterActive(false);
        setIsActive(false);
      });
    }

    // If the meter has been deactivated while recording, stop it
    if (!core.decibelMeterActive && isGlobalRecording) {
      stopMonitoring();
    }
  }, [core, core.decibelMeterActive, startMonitoring, stopMonitoring]);
  /**
   * Get color based on decibel level.
   */
  const getLevelColor = (level: number): string => {
    if (level < 40) return COLORS.SUCCESS; // Quiet - green
    if (level < 70) return COLORS.ACCENT; // Moderate - orange
    return COLORS.ERROR; // Loud - red
  };

  return (
    <ScreenBody>
      <SectionHeader>Decibel Meter</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Meter Display */}
          <View
            style={[
              styles.meterContainer,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.SECONDARY_ACCENT,
              },
            ]}
          >
            {/* Visual Bar Meter */}
            <View style={styles.barMeterContainer}>
              {[...Array(20)].map((_, i) => {
                const barLevel = (i + 1) * 5; // Each bar represents 5 dB
                const isBarActive = decibelLevel >= barLevel;
                const barColor = getLevelColor(barLevel);
                const barHeight = ((i + 1) / 20) * 120; // Height scales from 6px to 120px

                return (
                  <View
                    key={i}
                    style={[
                      styles.bar,
                      isBarActive ? styles.barActive : styles.barInactive,
                      {
                        height: barHeight,
                        backgroundColor: isBarActive
                          ? barColor
                          : COLORS.BACKGROUND,
                        borderColor: COLORS.SECONDARY_ACCENT,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            {!isActive ? (
              <AppButton
                label="Start Monitoring"
                onPress={handleStart}
                variant="success"
                icon="play"
                iconSize={24}
                accessibilityLabel="Start Decibel Meter"
              />
            ) : (
              <AppButton
                label="Stop Monitoring"
                onPress={handleStop}
                variant="destructive"
                icon="stop"
                iconSize={24}
                accessibilityLabel="Stop Decibel Meter"
              />
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenBody>
  );
};

export default observer(DecibelMeterScreenImpl);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingBottom: FOOTER_HEIGHT,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    paddingTop: SCROLL_PADDING,
    paddingBottom: 24,
    alignItems: 'center',
  },
  meterContainer: {
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  levelDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  levelNumber: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 72,
  },
  levelUnit: {
    fontSize: 32,
    fontWeight: '600',
    marginLeft: 8,
  },
  barMeterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 120,
    width: '100%',
    gap: 3,
  },
  bar: {
    flex: 1, // Equal width bars that flex to fill container
    borderRadius: 4,
    borderWidth: 1,
    // Height is set dynamically based on bar level to create proper meter visualization
  },
  barActive: {
    opacity: 1,
  },
  barInactive: {
    opacity: 0.3,
  },
  controlsContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  referenceContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  referenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  referenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  referenceLevel: {
    fontSize: 14,
    fontWeight: '700',
    width: 50,
  },
  referenceDescription: {
    fontSize: 14,
    flex: 1,
  },
});
