import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useRoute } from '@react-navigation/native';
import React, { JSX, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { FOOTER_HEIGHT } from '../../theme';

type Channel = {
  name: string;
  frequency: string;
  mode: string;
  notes?: string;
};

type FrequencyData = {
  id: string;
  title: string;
  requiresLicense: boolean;
  licenseInfo: string;
  description: string;
  channels: Channel[];
};

type RadioFrequencyDetailScreenRouteProp = RouteProp<
  { RadioFrequencyDetail: { frequencyData: FrequencyData } },
  'RadioFrequencyDetail'
>;

/**
 * Displays detailed information about a specific radio frequency type.
 *
 * Shows a list of national channels/frequencies in an easy-to-read table format,
 * includes licensing information and disclaimers, and is fully dark mode compliant.
 *
 * @component
 * @returns {JSX.Element} The rendered radio frequency detail screen.
 */
export default function RadioFrequencyDetailScreen(): JSX.Element {
  const route = useRoute<RadioFrequencyDetailScreenRouteProp>();
  const COLORS = useTheme();
  const { frequencyData } = route.params || {};
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  const disclaimerKey = frequencyData?.requiresLicense
    ? `@radiofrequency/${frequencyData.id}_disclaimer_dismissed`
    : null;

  useEffect(() => {
    if (!disclaimerKey) return;

    let isMounted = true;

    AsyncStorage.getItem(disclaimerKey)
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
  }, [disclaimerKey]);

  const handleDismissDisclaimer = useCallback(() => {
    if (disclaimerKey) {
      AsyncStorage.setItem(disclaimerKey, 'true').catch(() => {});
    }
    setDisclaimerVisible(false);
  }, [disclaimerKey]);

  if (!frequencyData) {
    return (
      <ScreenBody>
        <SectionHeader>Frequency Not Found</SectionHeader>
        <View style={styles.missingWrap}>
          <Text style={styles.helperText}>
            No data available for this frequency type.
          </Text>
        </View>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <SectionHeader>{frequencyData.title}</SectionHeader>

      <View style={styles.container}>
        {/* License info icon row */}
        <View style={styles.infoRow}>
          <TouchableOpacity
            onPress={() => setDisclaimerVisible(true)}
            accessibilityLabel="View license information"
            accessibilityRole="button"
            style={styles.infoButton}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={
                frequencyData.requiresLicense ? COLORS.ERROR : COLORS.SUCCESS
              }
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Description */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.BRAND,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: COLORS.PRIMARY_DARK }]}>
              About
            </Text>
            <Text style={[styles.cardBody, { color: COLORS.PRIMARY_DARK }]}>
              {frequencyData.description}
            </Text>
          </View>

          {/* Frequency Table */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.BRAND,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: COLORS.PRIMARY_DARK }]}>
              National Frequencies
            </Text>

            {/* Table Header */}
            <View
              style={[styles.tableHeader, { borderBottomColor: COLORS.BRAND }]}
            >
              <View style={styles.tableCell}>
                <Text
                  style={[styles.headerText, { color: COLORS.PRIMARY_DARK }]}
                >
                  Channel
                </Text>
              </View>
              <View style={styles.tableCell}>
                <Text
                  style={[styles.headerText, { color: COLORS.PRIMARY_DARK }]}
                >
                  Frequency
                </Text>
              </View>
              <View style={styles.tableCell}>
                <Text
                  style={[styles.headerText, { color: COLORS.PRIMARY_DARK }]}
                >
                  Mode
                </Text>
              </View>
            </View>

            {/* Table Rows */}
            {frequencyData.channels.map((channel, index) => (
              <View key={index}>
                <View
                  style={[
                    styles.tableRow,
                    index % 2 === 1 && {
                      backgroundColor: COLORS.BACKGROUND,
                    },
                  ]}
                >
                  <View style={styles.tableCell}>
                    <Text
                      style={[styles.cellText, { color: COLORS.PRIMARY_DARK }]}
                    >
                      {channel.name}
                    </Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text
                      style={[
                        styles.cellText,
                        styles.frequencyText,
                        { color: COLORS.PRIMARY_DARK },
                      ]}
                    >
                      {channel.frequency}
                    </Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text
                      style={[styles.cellText, { color: COLORS.PRIMARY_DARK }]}
                    >
                      {channel.mode}
                    </Text>
                  </View>
                </View>
                {channel.notes && (
                  <View
                    style={[
                      styles.notesRow,
                      index % 2 === 1 && {
                        backgroundColor: COLORS.BACKGROUND,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.notesText, { color: COLORS.PRIMARY_DARK }]}
                    >
                      {channel.notes}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* License disclaimer modal */}
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
                borderColor: COLORS.BRAND,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: COLORS.PRIMARY_DARK }]}>
              {frequencyData.title} License Information
            </Text>
            <View
              style={[
                styles.licenseCard,
                {
                  backgroundColor: frequencyData.requiresLicense
                    ? COLORS.ERROR_LIGHT
                    : COLORS.SUCCESS_LIGHT,
                  borderColor: frequencyData.requiresLicense
                    ? COLORS.ERROR
                    : COLORS.SUCCESS,
                },
              ]}
            >
              <Text
                style={[styles.licenseText, { color: COLORS.PRIMARY_DARK }]}
              >
                {frequencyData.licenseInfo}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismissDisclaimer}
              style={[
                styles.modalDismissButton,
                { backgroundColor: COLORS.ACCENT },
              ]}
              accessibilityLabel="Dismiss license information"
              accessibilityRole="button"
            >
              <Text style={styles.modalDismissText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenBody>
  );
}

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
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  missingWrap: {
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  helperText: {
    fontSize: 16,
    opacity: 0.8,
  },
  licenseCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  licenseText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cellText: {
    fontSize: 13,
    lineHeight: 18,
  },
  frequencyText: {
    fontWeight: '600',
  },
  notesRow: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 4,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.8,
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  infoButton: {
    padding: 2,
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
