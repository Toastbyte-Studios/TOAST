import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useDeviceStatus } from '../../hooks/useDeviceStatus';
import { useTheme } from '../../hooks/useTheme';
import { FOOTER_HEIGHT } from '../../theme';

/**
 * DeviceStatusScreen
 *
 * Displays a summary of the device’s current health/status metrics in a simple
 * card-based UI.
 *
 * The screen renders:
 * - Battery status text
 * - Time/description of the last GPS fix
 * - Storage usage/availability
 * - Connectivity/offline status
 *
 * Data is sourced from {@link useDeviceStatus}, which provides pre-formatted
 * strings for display. Each metric is presented in a styled card with a shared
 * gradient background and consistent label/value typography.
 *
 * @returns A React element containing the Device Status screen UI.
 */
function DeviceStatusScreen() {
  const COLORS = useTheme();
  const { storageText, batteryText, lastFixText, offlineText } =
    useDeviceStatus();

  return (
    <ScreenBody>
      <SectionHeader>Device Status</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.PRIMARY_DARK }]}>
              Device Metrics
            </Text>

            <View
              style={[styles.card, { borderColor: COLORS.SECONDARY_ACCENT }]}
            >
              <LinearGradient
                colors={COLORS.BRAND_GRADIENT}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBackground}
              />
              <Text style={[styles.label, { color: COLORS.PRIMARY_DARK }]}>
                Battery
              </Text>
              <Text style={[styles.value, { color: COLORS.PRIMARY_DARK }]}>
                {batteryText}
              </Text>
            </View>

            <View
              style={[styles.card, { borderColor: COLORS.SECONDARY_ACCENT }]}
            >
              <LinearGradient
                colors={COLORS.BRAND_GRADIENT}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBackground}
              />
              <Text style={[styles.label, { color: COLORS.PRIMARY_DARK }]}>
                Last GPS Fix
              </Text>
              <Text style={[styles.value, { color: COLORS.PRIMARY_DARK }]}>
                {lastFixText}
              </Text>
            </View>

            <View
              style={[styles.card, { borderColor: COLORS.SECONDARY_ACCENT }]}
            >
              <LinearGradient
                colors={COLORS.BRAND_GRADIENT}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBackground}
              />
              <Text style={[styles.label, { color: COLORS.PRIMARY_DARK }]}>
                Storage
              </Text>
              <Text style={[styles.value, { color: COLORS.PRIMARY_DARK }]}>
                {storageText}
              </Text>
            </View>

            <View
              style={[styles.card, { borderColor: COLORS.SECONDARY_ACCENT }]}
            >
              <LinearGradient
                colors={COLORS.BRAND_GRADIENT}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBackground}
              />
              <Text style={[styles.label, { color: COLORS.PRIMARY_DARK }]}>
                Connectivity
              </Text>
              <Text style={[styles.value, { color: COLORS.PRIMARY_DARK }]}>
                {offlineText}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </ScreenBody>
  );
}

export default observer(DeviceStatusScreen);

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
    padding: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  cardBackground: {
    ...StyleSheet.absoluteFill,
  },
  label: {
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 6,
    fontWeight: '700',
  },
  value: {
    fontSize: 16,
  },
});
