import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { observer } from 'mobx-react-lite';
import React, { useMemo } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HorizontalRule } from '../../components/HorizontalRule';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useInventoryStore } from '../../stores';
import { InventoryItem } from '../../stores/InventoryStore';
import { FOOTER_HEIGHT } from '../../theme';

type InventoryCategoryParamList = {
  InventoryCategory: { category: string };
  EditInventoryItem: { item: InventoryItem };
};
type InventoryCategoryRouteProp = RouteProp<
  InventoryCategoryParamList,
  'InventoryCategory'
>;
type InventoryCategoryNavigationProp = NativeStackNavigationProp<
  InventoryCategoryParamList,
  'InventoryCategory'
>;

/**
 * Displays all inventory items for a specific category.
 *
 * This screen retrieves the category name from the navigation route parameters
 * and displays all items belonging to that category in a list layout.
 * If no items are found for the category, a helper message is shown.
 *
 * @returns {JSX.Element} The rendered inventory category screen component.
 */
export default observer(function InventoryCategoryScreen(): React.JSX.Element {
  const route = useRoute<InventoryCategoryRouteProp>();
  const navigation = useNavigation<InventoryCategoryNavigationProp>();
  const inventory = useInventoryStore();
  const COLORS = useTheme();

  const { category } = route.params || {};
  const isValidCategory = category && inventory.categories.includes(category);
  const items = useMemo(
    () => (isValidCategory ? (inventory.itemsByCategory[category] ?? []) : []),
    [isValidCategory, category, inventory.itemsByCategory],
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [items],
  );

  const handleAddItem = () => {
    navigation.navigate('NewInventoryItem', { category });
  };

  const handleItemPress = (item: InventoryItem) => {
    navigation.navigate('EditInventoryItem', { item });
  };

  return (
    <ScreenBody>
      <SectionHeader>{category}</SectionHeader>
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: COLORS.ACCENT }]}
          onPress={handleAddItem}
          accessibilityLabel="Add Item"
          accessibilityRole="button"
        >
          <Ionicons name="add-outline" size={24} color={COLORS.PRIMARY_LIGHT} />
          <Text style={[styles.addButtonText, { color: COLORS.PRIMARY_LIGHT }]}>
            Add Item
          </Text>
        </TouchableOpacity>
      </View>
      <HorizontalRule />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {sortedItems.length === 0 && (
            <Text style={[styles.helperText, { color: COLORS.PRIMARY_DARK }]}>
              No items in this category yet.
            </Text>
          )}
          {sortedItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                {
                  backgroundColor: COLORS.PRIMARY_LIGHT,
                  borderColor: COLORS.SECONDARY_ACCENT,
                },
              ]}
              onPress={() => handleItemPress(item)}
              accessibilityLabel={`View ${item.name}`}
              accessibilityRole="button"
            >
              <View style={styles.itemHeader}>
                <Ionicons
                  name="cube-outline"
                  size={24}
                  color={COLORS.PRIMARY_DARK}
                />
                <Text style={[styles.itemName, { color: COLORS.PRIMARY_DARK }]}>
                  {item.name}
                </Text>
              </View>
              <View style={styles.itemDetails}>
                <Text
                  style={[styles.itemQuantity, { color: COLORS.PRIMARY_DARK }]}
                >
                  Quantity: {item.quantity}
                  {item.unit ? ` ${item.unit}` : ''}
                </Text>
                {item.notes && (
                  <Text
                    style={[styles.itemNotes, { color: COLORS.PRIMARY_DARK }]}
                    numberOfLines={2}
                  >
                    {item.notes}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingBottom: FOOTER_HEIGHT,
  },
  actionBar: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    paddingHorizontal: 6,
    paddingBottom: 24,
  },
  helperText: {
    fontSize: 16,
    opacity: 0.8,
    marginHorizontal: 6,
    marginBottom: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  itemDetails: {
    gap: 4,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemNotes: {
    fontSize: 13,
    opacity: 0.7,
  },
});
