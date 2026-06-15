import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HorizontalRule } from '../../components/HorizontalRule';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import radioFrequenciesData from '../../data/radioFrequencies.json';
import { useTheme } from '../../hooks/useTheme';
import { Repeater } from '../../stores/RepeaterBookStore';
import { useRepeaterBookStore } from '../../stores/StoreContext';
import { FOOTER_HEIGHT } from '../../theme';
import { ColorScheme } from '../../theme/colors';

const DISCLAIMER_KEY = '@repeaterbook/disclaimer_dismissed';
const hamData =
  radioFrequenciesData.frequencies[
    'HAM' as keyof typeof radioFrequenciesData.frequencies
  ];
const gmrsData =
  radioFrequenciesData.frequencies[
    'GMRS' as keyof typeof radioFrequenciesData.frequencies
  ];

/**
 * Displays the list of local ham radio repeaters fetched from RepeaterBook.
 *
 * On mount the store fetches (or reuses cached) repeater data for the user's
 * current location.  A new fetch is triggered automatically whenever the user
 * has moved more than 50 miles from the previous query point.
 *
 * @returns {JSX.Element} The rendered local repeaters screen.
 */
const RepeaterBookScreen = observer((): JSX.Element => {
  const COLORS = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const store = useRepeaterBookStore();
  const [modePickerVisible, setModePickerVisible] = useState(false);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    store.initialize();
    AsyncStorage.getItem(DISCLAIMER_KEY)
      .then((value) => {
        if (!isMounted) {
          return;
        }
        if (value !== 'true') {
          setDisclaimerVisible(true);
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setDisclaimerVisible(true);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismissDisclaimer = useCallback(() => {
    AsyncStorage.setItem(DISCLAIMER_KEY, 'true').catch(() => {});
    setDisclaimerVisible(false);
  }, []);

  const handleRepeaterPress = (repeater: Repeater) => {
    navigation.navigate('RepeaterDetail', { repeater });
  };

  const formatLastUpdated = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <ScreenBody>
      <SectionHeader>Local Repeaters</SectionHeader>

      <View style={styles.container}>
        {/* Filter row: mode dropdown + on-air toggle */}
        <View style={styles.filterRow}>
          {/* Mode dropdown */}
          <TouchableOpacity
            style={[
              styles.dropdown,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.TOAST_BROWN,
              },
            ]}
            onPress={() => setModePickerVisible(true)}
            accessibilityLabel="Mode filter"
            accessibilityHint={`Currently ${store.selectedMode}. Tap to change mode.`}
            accessibilityRole="button"
          >
            <Text style={[styles.dropdownText, { color: COLORS.PRIMARY_DARK }]}>
              {store.selectedMode}
            </Text>
            <Ionicons
              name="chevron-down-outline"
              size={14}
              color={COLORS.PRIMARY_DARK}
            />
          </TouchableOpacity>

          {/* Toggles column: On-air + Emergency stacked */}
          <View style={styles.toggleColumn}>
            <View style={styles.toggleGroup}>
              <Text
                style={[styles.toggleLabel, { color: COLORS.PRIMARY_DARK }]}
              >
                On-air
              </Text>
              <Switch
                value={store.onAirOnly}
                onValueChange={(v) => store.setOnAirOnly(v)}
                trackColor={{
                  false: COLORS.TOAST_BROWN,
                  true: COLORS.SUCCESS,
                }}
                thumbColor={COLORS.PRIMARY_LIGHT}
                accessibilityLabel="Filter to show only on-air repeaters"
                accessibilityRole="switch"
              />
            </View>
            <View style={styles.toggleGroup}>
              <Text
                style={[styles.toggleLabel, { color: COLORS.PRIMARY_DARK }]}
              >
                🚨
              </Text>
              <Switch
                value={store.emergencyOnly}
                onValueChange={(v) => store.setEmergencyOnly(v)}
                trackColor={{
                  false: COLORS.TOAST_BROWN,
                  true: COLORS.ERROR,
                }}
                thumbColor={COLORS.PRIMARY_LIGHT}
                accessibilityLabel="Filter to show only emergency communications repeaters"
                accessibilityRole="switch"
              />
            </View>
          </View>

          {/* Icons column: license info + add repeater stacked */}
          <View style={styles.iconColumn}>
            <TouchableOpacity
              onPress={() => setDisclaimerVisible(true)}
              accessibilityLabel="View HAM and GMRS license requirements"
              accessibilityRole="button"
              style={styles.iconButton}
            >
              <Ionicons
                name="information-circle-outline"
                size={28}
                color={COLORS.ERROR}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddCustomRepeater')}
              accessibilityLabel="Add custom repeater"
              accessibilityRole="button"
              style={styles.iconButton}
            >
              <Ionicons
                name="add-circle-outline"
                size={28}
                color={COLORS.ACCENT}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.ruleWrap}>
          <HorizontalRule />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Loading spinner */}
          {store.isLoading && store.repeaters.length === 0 && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={COLORS.ACCENT} />
              <Text style={[styles.helperText, { color: COLORS.PRIMARY_DARK }]}>
                Loading repeaters…
              </Text>
            </View>
          )}

          {/* Error message */}
          {store.error && store.repeaters.length === 0 && (
            <View
              style={[
                styles.errorCard,
                {
                  backgroundColor: COLORS.ERROR_LIGHT,
                  borderColor: COLORS.ERROR,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: COLORS.PRIMARY_DARK }]}>
                {store.error}
              </Text>
              <Text style={[styles.helperText, { color: COLORS.PRIMARY_DARK }]}>
                Connect to the internet to load repeater data.
              </Text>
            </View>
          )}

          {/* Empty state */}
          {!store.isLoading && !store.error && store.repeaters.length === 0 && (
            <View style={styles.centered}>
              <Text style={[styles.helperText, { color: COLORS.PRIMARY_DARK }]}>
                No repeaters found nearby.
              </Text>
            </View>
          )}

          {/* Repeater list */}
          {store.filteredRepeaters.map((repeater, index) => (
            <TouchableOpacity
              key={repeater.id || index}
              onPress={() => handleRepeaterPress(repeater)}
              style={[
                styles.row,
                {
                  backgroundColor: COLORS.PRIMARY_LIGHT,
                  borderColor: COLORS.TOAST_BROWN,
                },
              ]}
            >
              {/* Operational status dot */}
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      repeater.operationalStatus === 'On-air'
                        ? COLORS.SUCCESS
                        : COLORS.TOAST_BROWN,
                  },
                ]}
              />

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text
                    style={[styles.callSign, { color: COLORS.PRIMARY_DARK }]}
                  >
                    {repeater.callSign}
                  </Text>
                  <Text
                    style={[styles.distance, { color: COLORS.PRIMARY_DARK }]}
                  >
                    {repeater.distance} mi
                  </Text>
                </View>

                <View style={styles.rowMeta}>
                  <Text
                    style={[styles.metaText, { color: COLORS.PRIMARY_DARK }]}
                  >
                    {repeater.frequency} MHz
                  </Text>
                  {repeater.offset ? (
                    <Text
                      style={[styles.metaText, { color: COLORS.PRIMARY_DARK }]}
                    >
                      {' '}
                      · {repeater.offset}
                    </Text>
                  ) : null}
                  {repeater.tone ? (
                    <Text
                      style={[styles.metaText, { color: COLORS.PRIMARY_DARK }]}
                    >
                      {' '}
                      · PL {repeater.tone}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.rowBottom}>
                  <View
                    style={[styles.modeBadge, { borderColor: COLORS.ACCENT }]}
                  >
                    <Text style={[styles.modeText, { color: COLORS.ACCENT }]}>
                      {repeater.mode}
                    </Text>
                  </View>
                  {repeater.isCustom && (
                    <View
                      style={[
                        styles.customBadge,
                        { borderColor: COLORS.SUCCESS },
                      ]}
                    >
                      <Text
                        style={[
                          styles.customBadgeText,
                          { color: COLORS.SUCCESS },
                        ]}
                      >
                        Custom
                      </Text>
                    </View>
                  )}
                  {repeater.emcomm ? (
                    <View
                      style={[
                        styles.emcommBadge,
                        { borderColor: COLORS.ERROR },
                      ]}
                    >
                      <Text
                        style={[styles.emcommText, { color: COLORS.ERROR }]}
                      >
                        🚨 {repeater.emcomm}
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    style={[
                      styles.locationText,
                      { color: COLORS.PRIMARY_DARK },
                    ]}
                  >
                    {repeater.city}
                    {repeater.state ? `, ${repeater.state}` : ''}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Background refresh indicator */}
          {store.isLoading && store.repeaters.length > 0 && (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={COLORS.ACCENT} />
              <Text
                style={[styles.refreshText, { color: COLORS.PRIMARY_DARK }]}
              >
                Refreshing…
              </Text>
            </View>
          )}

          {/* Data source disclaimer */}
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.repeaterbook.com')}
            accessibilityRole="link"
            accessibilityLabel="Open RepeaterBook.com"
          >
            <Text
              style={[styles.disclaimerText, { color: COLORS.PRIMARY_DARK }]}
            >
              Data sourced from{' '}
              <Text style={styles.disclaimerLink}>RepeaterBook.com</Text>
            </Text>
          </TouchableOpacity>

          {/* Cache / live data status */}
          {(store.lastUpdated || store.isCachedData) && (
            <Text
              style={[styles.cacheStatusText, { color: COLORS.PRIMARY_DARK }]}
            >
              {store.isCachedData ? '📦 Cached data' : '✅ Live data'}
              {store.lastUpdated
                ? `  ·  Updated ${formatLastUpdated(store.lastUpdated)}`
                : ''}
            </Text>
          )}
        </ScrollView>
      </View>

      {/* Mode picker modal */}
      <Modal
        visible={modePickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModePickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModePickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalSheet,
                  {
                    backgroundColor: COLORS.PRIMARY_LIGHT,
                    borderColor: COLORS.TOAST_BROWN,
                  },
                ]}
              >
                <Text
                  style={[styles.modalTitle, { color: COLORS.PRIMARY_DARK }]}
                >
                  Mode
                </Text>
                {store.modes.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => {
                      store.setSelectedMode(mode);
                      setModePickerVisible(false);
                    }}
                    style={[
                      styles.modalOption,
                      mode === store.selectedMode && {
                        backgroundColor: COLORS.ACCENT,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        mode === store.selectedMode
                          ? styles.modalOptionTextSelected
                          : styles.modalOptionTextUnselected,
                      ]}
                    >
                      {mode}
                    </Text>
                    {mode === store.selectedMode && (
                      <Ionicons
                        name="checkmark-outline"
                        size={16}
                        color={COLORS.PRIMARY_LIGHT}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* HAM & GMRS license disclaimer modal */}
      <Modal
        visible={disclaimerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.TOAST_BROWN,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: COLORS.PRIMARY_DARK }]}>
              License Requirements
            </Text>
            <View
              style={[
                styles.licenseCard,
                {
                  backgroundColor: COLORS.ERROR_LIGHT,
                  borderColor: COLORS.ERROR,
                },
              ]}
            >
              <Text
                style={[styles.licenseText, { color: COLORS.PRIMARY_DARK }]}
              >
                {hamData.licenseInfo}
              </Text>
            </View>
            <View
              style={[
                styles.licenseCard,
                {
                  backgroundColor: COLORS.ERROR_LIGHT,
                  borderColor: COLORS.ERROR,
                },
              ]}
            >
              <Text
                style={[styles.licenseText, { color: COLORS.PRIMARY_DARK }]}
              >
                {gmrsData.licenseInfo}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismissDisclaimer}
              style={[
                styles.modalDismissButton,
                { backgroundColor: COLORS.ACCENT },
              ]}
              accessibilityLabel="Dismiss disclaimer"
              accessibilityRole="button"
            >
              <Text style={styles.modalDismissText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenBody>
  );
});

export default RepeaterBookScreen;

const createStyles = (COLORS: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      alignSelf: 'stretch',
      paddingBottom: FOOTER_HEIGHT,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 14,
      marginTop: 10,
      gap: 12,
    },
    dropdown: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    dropdownText: {
      fontSize: 14,
      fontWeight: '600',
    },
    toggleColumn: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 6,
    },
    toggleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    toggleLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    iconColumn: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    },
    iconButton: {
      padding: 2,
    },
    ruleWrap: {
      marginTop: 10,
    },
    scrollView: {
      flex: 1,
      width: '100%',
      paddingTop: 8,
    },
    scrollContent: {
      paddingHorizontal: 14,
      paddingBottom: 24,
    },
    centered: {
      paddingTop: 40,
      alignItems: 'center',
      gap: 12,
    },
    helperText: {
      fontSize: 15,
      opacity: 0.8,
      textAlign: 'center',
    },
    errorCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginTop: 12,
      gap: 6,
    },
    errorText: {
      fontSize: 14,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      gap: 10,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 5,
    },
    rowBody: {
      flex: 1,
      gap: 4,
    },
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    callSign: {
      fontSize: 16,
      fontWeight: '700',
    },
    distance: {
      fontSize: 13,
      opacity: 0.7,
    },
    rowMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    metaText: {
      fontSize: 13,
      fontWeight: '500',
    },
    rowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    modeBadge: {
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    modeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    emcommBadge: {
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    emcommText: {
      fontSize: 11,
      fontWeight: '700',
    },
    customBadge: {
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    customBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    locationText: {
      fontSize: 12,
      opacity: 0.7,
      flex: 1,
    },
    refreshRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 8,
    },
    refreshText: {
      fontSize: 13,
      opacity: 0.7,
    },
    disclaimerText: {
      fontSize: 12,
      opacity: 0.65,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 2,
    },
    disclaimerLink: {
      textDecorationLine: 'underline',
    },
    cacheStatusText: {
      fontSize: 12,
      opacity: 0.65,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 8,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    modalSheet: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      gap: 4,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    modalOptionText: {
      fontSize: 15,
      fontWeight: '500',
    },
    modalOptionTextSelected: {
      color: COLORS.PRIMARY_LIGHT,
    },
    modalOptionTextUnselected: {
      color: COLORS.PRIMARY_DARK,
    },
    licenseCard: {
      borderWidth: 2,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    licenseText: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    modalDismissButton: {
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    modalDismissText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
  });

// Re-export route param type for AppNavigator
export type RepeaterBookScreenParams = undefined;
