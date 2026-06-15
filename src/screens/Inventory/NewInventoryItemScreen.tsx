import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useInventoryStore } from '../../stores';
import {
  FormInput,
  FormTextArea,
  FormButtonRow,
  QuantityUnitRow,
  ExpirationDatePicker,
} from '../Shared/Prepper';
import { inventoryFormStyles as styles } from './inventoryFormStyles';

type NewInventoryItemRouteProp = RouteProp<
  { NewInventoryItem: { category: string } },
  'NewInventoryItem'
>;

/**
 * Screen for adding a new inventory item.
 *
 * Allows users to:
 * - Enter item name (required)
 * - Set quantity (required, default 1)
 * - Specify unit (optional, e.g., "pieces", "lbs", "gallons")
 * - Add notes (optional)
 * - Set expiration date (optional, month and year)
 *
 * @returns {React.JSX.Element} The rendered new inventory item screen component.
 */
export default observer(function NewInventoryItemScreen(): React.JSX.Element {
  const route = useRoute<NewInventoryItemRouteProp>();
  const navigation = useNavigation();
  const inventory = useInventoryStore();

  const { category } = route.params || {};
  const [name, setName] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [unit, setUnit] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [expirationMonth, setExpirationMonth] = useState<number | undefined>();
  const [expirationYear, setExpirationYear] = useState<number | undefined>();

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
      await inventory.createItem(
        trimmedName,
        category,
        quantityNum,
        unit.trim() || undefined,
        notes.trim() || undefined,
        expirationMonth,
        expirationYear,
      );
      Alert.alert('Success', 'Item added successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to add item');
    }
  };

  return (
    <ScreenBody>
      <SectionHeader>Add Item to {category}</SectionHeader>
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
            autoFocus
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
        </ScrollView>
      </View>
    </ScreenBody>
  );
});
