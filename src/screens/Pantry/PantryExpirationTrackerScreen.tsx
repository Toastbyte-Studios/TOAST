import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { observer } from 'mobx-react-lite';
import React, { useState, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HorizontalRule } from '../../components/HorizontalRule';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { usePantryStore } from '../../stores';
import { ExpirationStatus, PantryItem } from '../../stores/PantryStore';
import { FOOTER_HEIGHT } from '../../theme';

type PantryExpirationTrackerNavigationProp = NativeStackNavigationProp<
  { EditPantryItem: { item: PantryItem } },
  'EditPantryItem'
>;

const MONTH_NAMES = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Returns a human-readable expiration label for an item. */
function formatExpiration(month?: number, year?: number): string {
  if (!month || !year) {
    return 'No expiration date';
  }
  return `Expires ${MONTH_NAMES[month]} ${year}`;
}

/** Returns a human-readable label for how many days remain. */
function formatDaysRemaining(days: number | null): string {
  if (days === null) {
    return '';
  }
  if (days < 0) {
    return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  }
  if (days === 0) {
    return 'Expires today!';
  }
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

/**
 * Pantry Expiration Tracker screen.
 *
 * Displays all pantry items with expiration dates sorted by soonest expiration.
 * Items are color-coded:
 * - Green  — 30+ days remaining
 * - Yellow — within 30 days
 * - Red    — expired (expiration month has passed; days <= 0)
 *
 * Provides category filtering and a quick "Mark as Used" action that
 * decrements an item's quantity by one (removing the item when it reaches zero).
 *
 * @returns {React.JSX.Element} The rendered expiration tracker screen.
 */
export default observer(
  function PantryExpirationTrackerScreen(): React.JSX.Element {
    const navigation = useNavigation<PantryExpirationTrackerNavigationProp>();
    const pantry = usePantryStore();
    const COLORS = useTheme();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
      null,
    );

    const sortedItems = pantry.itemsSortedByExpiration();

    const filteredItems =
      selectedCategory === null
        ? sortedItems
        : sortedItems.filter((item) => item.category === selectedCategory);

    const handleItemPress = useCallback(
      (item: PantryItem) => {
        navigation.navigate('EditPantryItem', { item });
      },
      [navigation],
    );

    const handleMarkUsed = useCallback(
      (item: PantryItem) => {
        if (item.quantity > 1) {
          Alert.alert(
            'Mark as Used',
            `Reduce "${item.name}" by 1?\n\nCurrent quantity: ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Use 1',
                onPress: async () => {
                  try {
                    await pantry.updateItem(item.id, {
                      quantity: item.quantity - 1,
                    });
                  } catch (error) {
                    Alert.alert(
                      'Error',
                      error.message || 'Failed to update item',
                    );
                  }
                },
              },
            ],
          );
        } else {
          Alert.alert(
            'Mark as Used',
            `Remove "${item.name}" from your pantry? (Last unit)`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await pantry.deleteItem(item.id);
                  } catch (error) {
                    Alert.alert(
                      'Error',
                      error.message || 'Failed to delete item',
                    );
                  }
                },
              },
            ],
          );
        }
      },
      [pantry],
    );

    /** Border color based on expiration status. */
    const statusBorderColor = (status: ExpirationStatus): string => {
      switch (status) {
        case 'red':
          return '#d32f2f';
        case 'yellow':
          return '#f9a825';
        case 'green':
          return '#388e3c';
        default:
          return COLORS.SECONDARY_ACCENT;
      }
    };

    /** Faint background tint based on expiration status. */
    const statusBackgroundColor = (status: ExpirationStatus): string => {
      switch (status) {
        case 'red':
          return 'rgba(211,47,47,0.08)';
        case 'yellow':
          return 'rgba(249,168,37,0.08)';
        case 'green':
          return 'rgba(56,142,60,0.08)';
        default:
          return COLORS.PRIMARY_LIGHT;
      }
    };

    return (
      <ScreenBody>
        <SectionHeader>Expiration Tracker</SectionHeader>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  selectedCategory === null
                    ? COLORS.ACCENT
                    : COLORS.PRIMARY_LIGHT,
                borderColor:
                  selectedCategory === null
                    ? COLORS.ACCENT
                    : COLORS.SECONDARY_ACCENT,
              },
            ]}
            onPress={() => setSelectedCategory(null)}
            accessibilityLabel="Show all categories"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    selectedCategory === null
                      ? COLORS.PRIMARY_LIGHT
                      : COLORS.PRIMARY_DARK,
                },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {pantry.categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedCategory === cat
                      ? COLORS.ACCENT
                      : COLORS.PRIMARY_LIGHT,
                  borderColor:
                    selectedCategory === cat
                      ? COLORS.ACCENT
                      : COLORS.SECONDARY_ACCENT,
                },
              ]}
              onPress={() =>
                setSelectedCategory(selectedCategory === cat ? null : cat)
              }
              accessibilityLabel={`Filter by ${cat}`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color:
                      selectedCategory === cat
                        ? COLORS.PRIMARY_LIGHT
                        : COLORS.PRIMARY_DARK,
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <HorizontalRule />

        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {filteredItems.length === 0 && (
              <Text style={[styles.emptyText, { color: COLORS.PRIMARY_DARK }]}>
                {sortedItems.length === 0
                  ? 'No items with expiration dates. Add expiration dates to your pantry items to track them here.'
                  : 'No items in this category have expiration dates.'}
              </Text>
            )}

            {filteredItems.map((item) => {
              const days = pantry.getExpirationDaysRemaining(item);
              const status = pantry.getExpirationStatus(item);
              const borderColor = statusBorderColor(status);
              const bgColor = statusBackgroundColor(status);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: bgColor,
                      borderColor,
                    },
                  ]}
                  onPress={() => handleItemPress(item)}
                  accessibilityLabel={`Edit ${item.name}`}
                  accessibilityRole="button"
                >
                  <View style={styles.itemRow}>
                    {/* Status indicator dot */}
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: borderColor },
                      ]}
                    />

                    <View style={styles.itemInfo}>
                      <Text
                        style={[
                          styles.itemName,
                          { color: COLORS.PRIMARY_DARK },
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.itemCategory,
                          { color: COLORS.PRIMARY_DARK },
                        ]}
                      >
                        {item.category}
                        {' · '}
                        {item.quantity}
                        {item.unit ? ` ${item.unit}` : ''}
                      </Text>
                      <Text
                        style={[styles.expirationText, { color: borderColor }]}
                      >
                        {formatExpiration(
                          item.expirationMonth,
                          item.expirationYear,
                        )}
                      </Text>
                      {days !== null && (
                        <Text
                          style={[
                            styles.daysText,
                            { color: COLORS.PRIMARY_DARK },
                          ]}
                        >
                          {formatDaysRemaining(days)}
                        </Text>
                      )}
                    </View>

                    {/* Used/Rotated quick action */}
                    <TouchableOpacity
                      style={[
                        styles.usedButton,
                        { borderColor: COLORS.SECONDARY_ACCENT },
                      ]}
                      onPress={() => handleMarkUsed(item)}
                      accessibilityLabel={`Mark ${item.name} as used`}
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={28}
                        color={COLORS.PRIMARY_DARK}
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScreenBody>
    );
  },
);

const styles = StyleSheet.create({
  filterRow: {
    width: '100%',
    flexShrink: 0,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 6,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
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
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 32,
    marginHorizontal: 16,
    lineHeight: 22,
  },
  itemCard: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '600',
  },
  itemCategory: {
    fontSize: 13,
    opacity: 0.65,
  },
  expirationText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  daysText: {
    fontSize: 12,
    opacity: 0.75,
  },
  usedButton: {
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
