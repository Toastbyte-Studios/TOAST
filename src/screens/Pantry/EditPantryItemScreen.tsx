import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { usePantryStore } from '../../stores';
import { PantryItem } from '../../stores/PantryStore';
import {
  FormInput,
  FormTextArea,
  FormButtonRow,
  DeleteButton,
  QuantityUnitRow,
  ExpirationDatePicker,
} from '../Shared/Prepper';
import { pantryFormStyles as styles } from './pantryFormStyles';

type EditPantryItemRouteProp = RouteProp<
  { EditPantryItem: { item: PantryItem } },
  'EditPantryItem'
>;

/**
 * Screen for editing an existing pantry item.
 *
 * Allows users to:
 * - Edit item name
 * - Update quantity
 * - Change unit
 * - Modify notes
 * - Set expiration date (optional, month and year)
 * - Delete the item
 *
 * @returns {React.JSX.Element} The rendered edit pantry item screen component.
 */
export default observer(function EditPantryItemScreen(): React.JSX.Element {
  const route = useRoute<EditPantryItemRouteProp>();
  const navigation = useNavigation();
  const pantry = usePantryStore();
  const COLORS = useTheme();

  const { item } = route.params || {};
  const [name, setName] = useState<string>(item?.name || '');
  const [quantity, setQuantity] = useState<string>(
    item?.quantity?.toString() || '1',
  );
  const [unit, setUnit] = useState<string>(item?.unit || '');
  const [notes, setNotes] = useState<string>(item?.notes || '');
  const [expirationMonth, setExpirationMonth] = useState<number | undefined>(
    item?.expirationMonth,
  );
  const [expirationYear, setExpirationYear] = useState<number | undefined>(
    item?.expirationYear,
  );

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Item name is required');
      return;
    }

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum < 0) {
      Alert.alert('Error', 'Please enter a valid quantity (0 or greater)');
      return;
    }

    try {
      await pantry.updateItem(item.id, {
        name: trimmedName,
        quantity: quantityNum,
        unit: unit.trim() || undefined,
        notes: notes.trim() || undefined,
        expirationMonth,
        expirationYear,
      });
      Alert.alert('Success', 'Item updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to update item');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await pantry.deleteItem(item.id);
              Alert.alert('Success', 'Item deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                (error as Error).message || 'Failed to delete item',
              );
            }
          },
        },
      ],
    );
  };

  if (!item) {
    return (
      <ScreenBody>
        <SectionHeader>Edit Item</SectionHeader>
        <View style={styles.container}>
          <Text
            style={[styles.errorText, { color: COLORS.ERROR || '#d32f2f' }]}
          >
            Item not found
          </Text>
        </View>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <SectionHeader>Edit Item</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <FormInput
            label="Item Name *"
            placeholder="Enter item name..."
            value={name}
            onChangeText={setName}
            accessibilityLabel="Item name"
          />

          <QuantityUnitRow
            quantity={quantity}
            unit={unit}
            onQuantityChange={setQuantity}
            onUnitChange={setUnit}
          />

          <ExpirationDatePicker
            month={expirationMonth}
            year={expirationYear}
            onMonthChange={setExpirationMonth}
            onYearChange={setExpirationYear}
          />

          <FormTextArea
            label="Notes (optional)"
            placeholder="Enter notes..."
            value={notes}
            onChangeText={setNotes}
            accessibilityLabel="Notes"
          />

          <FormButtonRow
            onCancel={() => navigation.goBack()}
            onSave={handleSave}
            saveDisabled={!name.trim()}
            saveLabel="Save"
          />

          <DeleteButton onPress={handleDelete} />
        </ScrollView>
      </View>
    </ScreenBody>
  );
});
