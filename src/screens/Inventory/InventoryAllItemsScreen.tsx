import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { observer } from 'mobx-react-lite';
import React from 'react';
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

type InventoryAllItemsNavigationProp = NativeStackNavigationProp<
  { EditInventoryItem: { item: InventoryItem } },
  'EditInventoryItem'
>;

/**
 * Displays all inventory items from all categories, sorted alphabetically by name.
 *
 * This screen shows a comprehensive list of all inventory items across all categories.
 * Items are displayed in alphabetical order for easy searching and reference.
 *
 * @returns {JSX.Element} The rendered inventory all items screen component.
 */
export default observer(function InventoryAllItemsScreen(): React.JSX.Element {
  const navigation = useNavigation<InventoryAllItemsNavigationProp>();
  const inventory = useInventoryStore();
  const COLORS = useTheme();

  const allItems = inventory.allItemsSorted;

  const handleItemPress = (item: InventoryItem) => {
    navigation.navigate('EditInventoryItem', { item });
  };

  return (
    <ScreenBody>
      <SectionHeader>All Inventory Items</SectionHeader>
      <HorizontalRule />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {allItems.length === 0 && (
            <Text style={[styles.helperText, { color: COLORS.PRIMARY_DARK }]}>
              No inventory items yet. Add items from a category.
            </Text>
          )}
          {allItems.map((item) => (
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
                <View style={styles.itemHeaderText}>
                  <Text
                    style={[styles.itemName, { color: COLORS.PRIMARY_DARK }]}
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
                  </Text>
                </View>
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
  itemHeaderText: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
  },
  itemCategory: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
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
