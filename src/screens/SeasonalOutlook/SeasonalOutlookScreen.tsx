import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import SectionSubHeader from '../../components/SectionSubHeader';
import { useTheme } from '../../hooks/useTheme';
import {
  useCoreStore,
  useSettingsStore,
  useWeatherOutlookStore,
} from '../../stores/StoreContext';
import { FOOTER_HEIGHT } from '../../theme';
import {
  displayPrecipitation,
  displaySpeed,
  displayTemp,
} from '../../utils/unitConversions';

/** Converts cm to inches. */
function cmToInches(cm: number): number {
  return cm / 2.54;
}

/** Formats a month string "YYYY-MM" as a human-readable label, e.g. "Jan 2024". */
function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

// Location polling parameters
const LOCATION_WAIT_TIMEOUT_MS = 3000;
const LOCATION_CHECK_INTERVAL_MS = 500;

/**
 * SeasonalOutlookScreen
 *
 * Displays a month-by-month seasonal weather outlook for the user's current
 * location using SEAS5 ensemble data from the Open-Meteo Seasonal Forecast API.
 *
 * Data is labeled as "Seasonal Outlook (ensemble estimate)" to set appropriate
 * expectations.  Temperatures, precipitation, snowfall, and wind speed are
 * converted to the user's preferred units.
 *
 * @returns A React element containing the Seasonal Outlook screen UI.
 */
function SeasonalOutlookScreen() {
  const core = useCoreStore();
  const settings = useSettingsStore();
  const weatherStore = useWeatherOutlookStore();
  const COLORS = useTheme();

  const [locationError, setLocationError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const measurementSystem = settings.measurementSystem;

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!isMounted) return;

      setLocationError(null);

      // Wait briefly for a GPS fix
      if (!core.lastFix) {
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
        setLocationError(
          'Unable to get location. Please enable location services.',
        );
        return;
      }

      const { latitude, longitude } = core.lastFix.coords;
      await weatherStore.loadOutlook(latitude, longitude);
    };

    load();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMonth = (month: string) => {
    setExpandedMonth((prev) => (prev === month ? null : month));
  };

  // ---------- helpers ----------

  const renderPrecipLine = (precipMm: number) => {
    return displayPrecipitation(precipMm, measurementSystem);
  };

  const renderWindLine = (kmh: number) => {
    return displaySpeed(kmh, measurementSystem);
  };

  const renderSnowLine = (cm: number) => {
    if (measurementSystem === 'imperial') {
      return `${cmToInches(cm).toFixed(1)} in`;
    }
    return `${Math.round(cm)} cm`;
  };

  // ---------- render ----------

  return (
    <ScreenBody>
      <SectionHeader>Seasonal Outlook</SectionHeader>

      {/* Disclaimer banner */}
      <SectionSubHeader>
        Ensemble estimates · Not a precise forecast
      </SectionSubHeader>

      {/* Stale data warning */}
      {weatherStore.isStale && weatherStore.outlook && (
        <View
          style={[styles.staleWarning, { backgroundColor: COLORS.BACKGROUND }]}
        >
          <Ionicons
            name="cloud-offline-outline"
            size={16}
            color={COLORS.ACCENT}
          />
          <Text style={[styles.staleText, { color: COLORS.ACCENT }]}>
            {`Offline · Last updated ${new Date(
              weatherStore.outlook.fetchedAt,
            ).toLocaleDateString()}`}
          </Text>
        </View>
      )}

      {/* Loading */}
      {(weatherStore.isLoading || (!core.lastFix && !locationError)) && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
          <Text style={[styles.loadingText, { color: COLORS.PRIMARY_DARK }]}>
            {weatherStore.isLoading ? 'Loading forecast…' : 'Getting location…'}
          </Text>
        </View>
      )}

      {/* Location error */}
      {locationError && !weatherStore.isLoading && (
        <View style={styles.centerContainer}>
          <Ionicons
            name="location-outline"
            size={40}
            color={COLORS.SECONDARY_ACCENT}
          />
          <Text style={[styles.errorText, { color: COLORS.PRIMARY_DARK }]}>
            {locationError}
          </Text>
        </View>
      )}

      {/* Network error (no cached data) */}
      {weatherStore.error && !weatherStore.isLoading && (
        <View style={styles.centerContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={40}
            color={COLORS.SECONDARY_ACCENT}
          />
          <Text style={[styles.errorText, { color: COLORS.PRIMARY_DARK }]}>
            {weatherStore.error}
          </Text>
        </View>
      )}

      {/* Monthly cards */}
      {!weatherStore.isLoading &&
        !locationError &&
        !weatherStore.error &&
        weatherStore.outlook && (
          <View
            style={[styles.container, { paddingBottom: FOOTER_HEIGHT + 16 }]}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
            >
              {weatherStore.outlook.months.map((entry) => {
                const isExpanded = expandedMonth === entry.month;
                return (
                  <TouchableOpacity
                    key={entry.month}
                    onPress={() => toggleMonth(entry.month)}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatMonthLabel(entry.month)} outlook, ${isExpanded ? 'collapse' : 'expand'}`}
                    style={[
                      styles.card,
                      {
                        borderColor: COLORS.SECONDARY_ACCENT,
                        backgroundColor: COLORS.BACKGROUND,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={COLORS.BRAND_GRADIENT}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Header row */}
                    <View style={styles.cardHeader}>
                      <Text
                        style={[
                          styles.monthLabel,
                          { color: COLORS.PRIMARY_DARK },
                        ]}
                      >
                        {`${formatMonthLabel(entry.month)} Avg`}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={COLORS.PRIMARY_DARK}
                      />
                    </View>

                    {/* Summary row — always visible */}
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryItem}>
                        <Ionicons
                          name="thermometer-outline"
                          size={16}
                          color={COLORS.SECONDARY_ACCENT}
                        />
                        <Text
                          style={[
                            styles.summaryText,
                            { color: COLORS.PRIMARY_DARK },
                          ]}
                        >
                          {displayTemp(entry.tempMeanC, measurementSystem)}
                        </Text>
                      </View>

                      <View style={styles.summaryItem}>
                        <Ionicons
                          name="rainy-outline"
                          size={16}
                          color={COLORS.SECONDARY_ACCENT}
                        />
                        <Text
                          style={[
                            styles.summaryText,
                            { color: COLORS.PRIMARY_DARK },
                          ]}
                        >
                          {renderPrecipLine(entry.precipMm)}
                        </Text>
                      </View>
                    </View>

                    {/* Risk flags */}
                    <View style={styles.flagRow}>
                      {entry.snowfallCm > 1 && (
                        <View
                          style={[
                            styles.flag,
                            { backgroundColor: COLORS.SECONDARY_ACCENT },
                          ]}
                        >
                          <Ionicons
                            name="snow-outline"
                            size={12}
                            color="#fff"
                          />
                          <Text style={styles.flagText}>Snow</Text>
                        </View>
                      )}
                      {entry.windSpeedMeanKmh > 50 && (
                        <View
                          style={[
                            styles.flag,
                            { backgroundColor: COLORS.ACCENT },
                          ]}
                        >
                          <Ionicons
                            name="thunderstorm-outline"
                            size={12}
                            color="#fff"
                          />
                          <Text style={styles.flagText}>High Wind</Text>
                        </View>
                      )}
                      {entry.precipMm > 150 && (
                        <View
                          style={[
                            styles.flag,
                            { backgroundColor: COLORS.SECONDARY_ACCENT },
                          ]}
                        >
                          <Ionicons
                            name="water-outline"
                            size={12}
                            color="#fff"
                          />
                          <Text style={styles.flagText}>Heavy Rain</Text>
                        </View>
                      )}
                    </View>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        <View style={styles.divider} />

                        <View style={styles.detailRow}>
                          <Text
                            style={[
                              styles.detailLabel,
                              { color: COLORS.PRIMARY_DARK },
                            ]}
                          >
                            Snowfall
                          </Text>
                          <Text
                            style={[
                              styles.detailValue,
                              { color: COLORS.PRIMARY_DARK },
                            ]}
                          >
                            {renderSnowLine(entry.snowfallCm)}
                          </Text>
                        </View>

                        <View style={styles.detailRow}>
                          <Text
                            style={[
                              styles.detailLabel,
                              { color: COLORS.PRIMARY_DARK },
                            ]}
                          >
                            Wind Speed
                          </Text>
                          <Text
                            style={[
                              styles.detailValue,
                              { color: COLORS.PRIMARY_DARK },
                            ]}
                          >
                            {renderWindLine(entry.windSpeedMeanKmh)}
                          </Text>
                        </View>

                        <View style={styles.detailRow}>
                          <Text
                            style={[
                              styles.detailLabel,
                              { color: COLORS.PRIMARY_DARK },
                            ]}
                          >
                            Solar Radiation
                          </Text>
                          <Text
                            style={[
                              styles.detailValue,
                              { color: COLORS.PRIMARY_DARK },
                            ]}
                          >
                            {`${Math.round(entry.shortwaveRadiationSum)} MJ/m²`}
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
    </ScreenBody>
  );
}

export default observer(SeasonalOutlookScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
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
  staleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  staleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '90%',
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  flagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  flagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  expandedSection: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    opacity: 0.8,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
});
