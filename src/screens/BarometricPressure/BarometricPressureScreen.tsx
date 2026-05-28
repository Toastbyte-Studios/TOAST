import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useBarometricPressure } from '../../hooks/useBarometricPressure';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores';
import { FOOTER_HEIGHT } from '../../theme';
import {
  getPressureTrend,
  getTrendInterpretation,
  hasSufficientDataForTrend,
  hpaToInhg,
  MIN_WINDOW_COVERAGE,
  PressureTrend,
} from '../../utils/barometricPressure';
import { displayPressure } from '../../utils/unitConversions';

/** Available history window options in hours */
const WINDOW_OPTIONS = [1, 3, 6, 12, 24] as const;
type WindowHours = (typeof WINDOW_OPTIONS)[number];

const TREND_ARROW: Record<PressureTrend, string> = {
  Rising: '↑',
  Steady: '→',
  Falling: '↓',
};

/**
 * BarometricPressureScreen
 *
 * Displays the current barometric pressure from the device's onboard sensor
 * in both hPa and inHg, along with a selectable trend window (1–24 h) and a
 * trend direction indicator (Rising / Steady / Falling).
 *
 * All processing is done entirely offline.  On devices without a barometric
 * sensor the screen displays an informative message instead of crashing.
 *
 * @returns A React element containing the Barometric Pressure screen UI.
 */
function BarometricPressureScreen() {
  const COLORS = useTheme();
  const settingsStore = useSettingsStore();
  const { pressure, available, loading, history, error } =
    useBarometricPressure();
  const [windowHours, setWindowHours] = useState<WindowHours>(3);

  /** Filter history to the selected window (full samples, preserving timestamps) */
  const windowSamples = (() => {
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    return history.filter((s) => s.timestamp >= cutoff);
  })();
  const windowReadings = windowSamples.map((s) => s.pressure);

  const windowMs = windowHours * 60 * 60 * 1000;
  const sufficientData = hasSufficientDataForTrend(windowSamples, windowMs);

  const trend = getPressureTrend(windowReadings);
  const interpretation = getTrendInterpretation(trend);

  /**
   * Human-readable description of how much pressure history has been
   * accumulated inside the current window (used in the gathering-data card).
   */
  const dataSpanLabel = (() => {
    if (windowSamples.length < 2) {
      return 'No readings collected yet.';
    }
    const spanMs =
      windowSamples[windowSamples.length - 1].timestamp -
      windowSamples[0].timestamp;
    const totalMinutes = Math.floor(spanMs / 60_000);
    if (totalMinutes < 60) {
      return `${totalMinutes} min of data collected.`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
      return `${hours}h of data collected.`;
    }
    return `${hours}h ${minutes} min of data collected.`;
  })();

  /** Minimum hours of span needed for the current window (mirrors the gate in hasSufficientDataForTrend). */
  const neededHours = windowHours * MIN_WINDOW_COVERAGE;

  const pressureDisplay =
    pressure !== null
      ? displayPressure(pressure, settingsStore.measurementSystem)
      : null;
  const isImperial = settingsStore.measurementSystem === 'imperial';
  const pressureValueStr =
    pressure !== null
      ? isImperial
        ? hpaToInhg(pressure).toFixed(2)
        : Math.round(pressure).toString()
      : '';
  const pressureUnitStr =
    pressure !== null ? (isImperial ? 'inHg' : 'hPa') : '';

  const renderWindowButton = (hours: WindowHours) => {
    const isActive = hours === windowHours;
    const buttonBorder = { borderColor: COLORS.SECONDARY_ACCENT };
    const buttonBg = isActive
      ? { backgroundColor: COLORS.SECONDARY_ACCENT }
      : styles.windowButtonInactive;
    const textColor = {
      color: isActive ? COLORS.PRIMARY_LIGHT : COLORS.PRIMARY_DARK,
    };
    return (
      <TouchableOpacity
        key={hours}
        style={[styles.windowButton, buttonBorder, buttonBg]}
        onPress={() => setWindowHours(hours)}
        accessibilityRole="button"
        accessibilityLabel={`${hours} hour window`}
        accessibilityState={{ selected: isActive }}
      >
        <Text style={[styles.windowButtonText, textColor]}>{hours}h</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenBody>
      <SectionHeader>Barometric Pressure</SectionHeader>

      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
          <Text style={[styles.loadingText, { color: COLORS.PRIMARY_DARK }]}>
            Reading sensor…
          </Text>
        </View>
      )}

      {!available && !loading && (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: COLORS.PRIMARY_DARK }]}>
            {error ?? 'Barometer not available on this device.'}
          </Text>
        </View>
      )}

      {available && !loading && pressure !== null && (
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Current Reading */}
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: COLORS.PRIMARY_DARK }]}
              >
                Current Reading
              </Text>

              <View
                style={[styles.card, { borderColor: COLORS.SECONDARY_ACCENT }]}
              >
                <LinearGradient
                  colors={COLORS.TOAST_BROWN_GRADIENT}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardBackground}
                />
                <View style={styles.readingRow}>
                  <View
                    style={styles.readingBlock}
                    accessible={true}
                    accessibilityLabel={`Current pressure: ${pressureDisplay}`}
                  >
                    <Text
                      style={[
                        styles.readingValue,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                    >
                      {pressureValueStr}
                    </Text>
                    <Text
                      style={[
                        styles.readingUnit,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                    >
                      {pressureUnitStr}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Trend Window Selector */}
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: COLORS.PRIMARY_DARK }]}
              >
                Trend Window
              </Text>
              <View style={styles.windowRow}>
                {WINDOW_OPTIONS.map(renderWindowButton)}
              </View>
            </View>

            {/* Trend Indicator */}
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: COLORS.PRIMARY_DARK }]}
              >
                Pressure Trend
              </Text>
              <View
                style={[styles.card, { borderColor: COLORS.SECONDARY_ACCENT }]}
              >
                <LinearGradient
                  colors={COLORS.TOAST_BROWN_GRADIENT}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardBackground}
                />
                {sufficientData ? (
                  <>
                    <Text
                      style={[
                        styles.trendLabel,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                      accessibilityLabel={`Pressure trend: ${trend}`}
                    >
                      {TREND_ARROW[trend]} {trend}
                    </Text>
                    <Text
                      style={[
                        styles.trendInterpretation,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                      accessibilityLabel={interpretation}
                    >
                      {interpretation}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.trendLabel,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                      accessibilityLabel="Gathering pressure data"
                    >
                      Gathering Data…
                    </Text>
                    <Text
                      style={[
                        styles.trendInterpretation,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                    >
                      Not enough data for a reliable {windowHours}h trend yet.
                      About {neededHours}h of readings needed.
                    </Text>
                    <Text
                      style={[styles.trendNote, { color: COLORS.PRIMARY_DARK }]}
                    >
                      {dataSpanLabel} Readings are saved each time you open the
                      app.
                    </Text>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </ScreenBody>
  );
}

export default observer(BarometricPressureScreen);

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
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    width: '90%',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 20,
    overflow: 'hidden',
  },
  cardBackground: {
    ...StyleSheet.absoluteFill,
  },
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  readingBlock: {
    alignItems: 'center',
    flex: 1,
  },
  readingDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  readingValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  readingUnit: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
  },
  windowRow: {
    flexDirection: 'row',
    gap: 8,
  },
  windowButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  windowButtonInactive: {
    backgroundColor: 'transparent',
  },
  windowButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  trendLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  trendInterpretation: {
    fontSize: 14,
    opacity: 0.9,
  },
  trendNote: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
