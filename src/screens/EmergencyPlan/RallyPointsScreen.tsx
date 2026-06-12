import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import {
  Alert,
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
import { useEmergencyPlanStore } from '../../stores';
import { FOOTER_HEIGHT } from '../../theme';
import { ImportModal } from './ImportModal';
import { parseSharedRallyPoints, shareRallyPoints } from './shareUtils';

/**
 * Lists all rally points with options to add, share, or import them.
 *
 * Share exports all rally points as JSON via the native share sheet.
 * Import accepts the same JSON string pasted from a recipient.
 *
 * @returns The rally points list screen.
 */
export default observer(function RallyPointsScreen() {
  const navigation = useNavigation();
  const store = useEmergencyPlanStore();
  const COLORS = useTheme();
  const [importVisible, setImportVisible] = useState(false);

  const handleShare = async () => {
    if (store.rallyPoints.length === 0) {
      Alert.alert('Nothing to share', 'Add at least one rally point first.');
      return;
    }
    try {
      await shareRallyPoints(store.rallyPoints);
    } catch {
      // User cancelled or share failed — no-op
    }
  };

  const handleImport = async (raw: string) => {
    const points = parseSharedRallyPoints(raw);
    if (!points || points.length === 0) {
      Alert.alert(
        'Invalid data',
        'The pasted text is not a valid TOAST rally-points share.',
      );
      return;
    }
    let added = 0;
    for (const point of points) {
      try {
        await store.createRallyPoint(
          point.name,
          point.description,
          point.coordinates,
        );
        added++;
      } catch {
        // Skip duplicates or invalid entries
      }
    }
    setImportVisible(false);
    if (added === 0) {
      Alert.alert(
        'Import failed',
        'The data was valid but could not be saved. Please try again.',
      );
    } else {
      Alert.alert(
        'Import complete',
        `${added} rally point${added !== 1 ? 's' : ''} imported.`,
      );
    }
  };

  return (
    <ScreenBody>
      <SectionHeader>Rally Points</SectionHeader>
      <View style={styles.addRow}>
        {/* Share and Import icon buttons */}
        <TouchableOpacity
          style={[styles.iconButton, { borderColor: COLORS.SECONDARY_ACCENT }]}
          onPress={() => setImportVisible(true)}
          accessibilityLabel="Import rally points"
          accessibilityRole="button"
        >
          <Ionicons
            name="download-outline"
            size={20}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, { borderColor: COLORS.SECONDARY_ACCENT }]}
          onPress={handleShare}
          accessibilityLabel="Share rally points"
          accessibilityRole="button"
        >
          <Ionicons
            name="share-outline"
            size={20}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: COLORS.PRIMARY_DARK }]}
          onPress={() => navigation.navigate('NewRallyPoint')}
          accessibilityLabel="Add Rally Point"
          accessibilityRole="button"
        >
          <Ionicons name="add-outline" size={22} color={COLORS.PRIMARY_LIGHT} />
          <Text style={[styles.addButtonText, { color: COLORS.PRIMARY_LIGHT }]}>
            Add Location
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {store.rallyPoints.length === 0 && (
            <Text style={[styles.emptyText, { color: COLORS.PRIMARY_DARK }]}>
              No rally points yet. Add a meeting location to get started.
            </Text>
          )}
          {store.rallyPoints.map((point) => (
            <TouchableOpacity
              key={point.id}
              style={[
                styles.card,
                {
                  backgroundColor: COLORS.PRIMARY_LIGHT,
                  borderColor: COLORS.SECONDARY_ACCENT,
                },
              ]}
              onPress={() =>
                navigation.navigate('EditRallyPoint', { rallyPoint: point })
              }
              accessibilityLabel={`Edit ${point.name}`}
              accessibilityRole="button"
            >
              <View style={styles.cardBody}>
                <Text style={[styles.name, { color: COLORS.PRIMARY_DARK }]}>
                  {point.name}
                </Text>
                <Text
                  style={[styles.description, { color: COLORS.PRIMARY_DARK }]}
                >
                  {point.description}
                </Text>
                {point.coordinates ? (
                  <Text
                    style={[styles.coordinates, { color: COLORS.PRIMARY_DARK }]}
                  >
                    📍 {point.coordinates}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                color={COLORS.PRIMARY_DARK}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ImportModal
        visible={importVisible}
        title="Import Rally Points"
        hint="Paste the share code received from another TOAST user."
        onClose={() => setImportVisible(false)}
        onImport={handleImport}
      />
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  addRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 4,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    width: '100%',
    paddingBottom: FOOTER_HEIGHT,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardBody: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  coordinates: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 4,
  },
});
