import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import * as SunCalc from 'suncalc';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCoreStore } from '../../stores/StoreContext';
import { FOOTER_HEIGHT } from '../../theme';
import { formatTime } from '../../utils/timeFormat';

interface SunTimes {
  sunrise: string;
  sunset: string;
  dawn: string;
  dusk: string;
  solarNoon: string;
  goldenHourEnd: string;
  goldenHour: string;
  night: string;
  nightEnd: string;
}

/**
 * SunTimeScreen
 *
 * Displays sun-related times for the current location including:
 * - Sunrise and sunset
 * - Dawn and dusk (civil twilight)
 * - Solar noon
 * - Golden hour times
 * - Night start and end
 *
 * Uses the device's current location from the CoreStore and calculates
 * sun times offline using the suncalc library.
 *
 * @returns A React element containing the Sun Time screen UI.
 */

// Constants for location polling
const LOCATION_WAIT_TIMEOUT_MS = 3000;
const LOCATION_CHECK_INTERVAL_MS = 500;

function SunTimeScreen() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const core = useCoreStore();
  const [sunTimes, setSunTimes] = useState<SunTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchLocation = async () => {
      if (!isMounted) return;

      setLoading(true);
      setError(null);

      try {
        // Request location if not available: wait briefly for a fix
        if (!core.lastFix) {
          // Wait for location with a reasonable timeout
          let elapsed = 0;

          while (
            !core.lastFix &&
            elapsed < LOCATION_WAIT_TIMEOUT_MS &&
            isMounted
          ) {
            await new Promise<void>((resolve) =>
              setTimeout(resolve, LOCATION_CHECK_INTERVAL_MS),
            );
            elapsed += LOCATION_CHECK_INTERVAL_MS;
          }
        }

        if (!isMounted) return;

        if (!core.lastFix) {
          setError('Unable to get location. Please enable location services.');
          setLoading(false);
          return;
        }

        const { latitude, longitude } = core.lastFix.coords;
        const now = new Date();

        // Calculate sun times for today
        const times = SunCalc.getTimes(now, latitude, longitude);

        if (!isMounted) return;

        setSunTimes({
          sunrise: formatTime(times.sunrise),
          sunset: formatTime(times.sunset),
          dawn: formatTime(times.dawn),
          dusk: formatTime(times.dusk),
          solarNoon: formatTime(times.solarNoon),
          goldenHourEnd: formatTime(times.goldenHourEnd),
          goldenHour: formatTime(times.goldenHour),
          night: formatTime(times.night),
          nightEnd: formatTime(times.nightEnd),
        });
      } catch (err) {
        if (!isMounted) return;

        const errorMessage =
          err instanceof Error
            ? `Error: ${err.message}`
            : 'Invalid location data. Please try again.';
        setError(errorMessage);
        console.error('Sun time calculation error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLocation();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderCard = (label: string, value: string) => (
    <View style={styles.card} key={label}>
      <LinearGradient
        colors={COLORS.BRAND_GRADIENT}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardBackground}
      />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );

  return (
    <ScreenBody>
      <SectionHeader>Sun Times</SectionHeader>

      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {sunTimes && !loading && !error && (
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dawn & Dusk</Text>
              {renderCard('Dawn (Civil Twilight)', sunTimes.dawn)}
              {renderCard('Sunrise', sunTimes.sunrise)}
              {renderCard('Golden Hour End (Morning)', sunTimes.goldenHourEnd)}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Midday</Text>
              {renderCard('Solar Noon', sunTimes.solarNoon)}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Evening</Text>
              {renderCard('Golden Hour Start (Evening)', sunTimes.goldenHour)}
              {renderCard('Sunset', sunTimes.sunset)}
              {renderCard('Dusk (Civil Twilight)', sunTimes.dusk)}
              {renderCard('Night Start', sunTimes.night)}
              {renderCard('Night End', sunTimes.nightEnd)}
            </View>
          </ScrollView>
        </View>
      )}
    </ScreenBody>
  );
}

export default observer(SunTimeScreen);

const makeStyles = (COLORS: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
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
    section: {
      width: '90%',
      marginTop: 16,
    },
    sectionTitle: {
      color: COLORS.PRIMARY_DARK,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    card: {
      width: '100%',
      borderColor: COLORS.SECONDARY_ACCENT,
      borderRadius: 12,
      borderWidth: 2,
      paddingVertical: 16,
      paddingHorizontal: 16,
      marginTop: 12,
      overflow: 'hidden',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cardBackground: {
      ...StyleSheet.absoluteFill,
    },
    label: {
      color: COLORS.PRIMARY_DARK,
      fontSize: 14,
      opacity: 0.9,
      marginBottom: 6,
      fontWeight: '700',
    },
    value: {
      color: COLORS.PRIMARY_DARK,
      fontSize: 16,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 40,
    },
    loadingText: {
      color: COLORS.PRIMARY_DARK,
      marginTop: 12,
      fontSize: 16,
    },
    errorText: {
      color: COLORS.PRIMARY_DARK,
      fontSize: 16,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
  });
