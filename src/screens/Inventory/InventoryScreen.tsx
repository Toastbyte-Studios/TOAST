import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CardTopic from '../../components/CardTopic';
import Grid from '../../components/Grid';
import { HorizontalRule } from '../../components/HorizontalRule';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useInventoryStore } from '../../stores';

/**
 * Inventory landing screen.
 *
 * @remarks
 * Presents a dashboard of inventory-related actions and routes:
 * - **View All** → navigates to the `InventoryAllItems` screen showing all items alphabetically
 * - **Manage Categories** → navigates to the `ManageInventoryCategories` screen
 * - **Inventory Categories** → mapped as CardTopic cards that navigate to category-specific screens
 *
 * Uses React Navigation to perform screen transitions from card taps.
 *
 * @returns A screen layout containing a header, action buttons, and a grid of navigation cards.
 */
export default observer(function InventoryScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const inventory = useInventoryStore();
  const COLORS = useTheme();

  const categoryIcons: Record<string, string> = {
    'Home Base': 'home-outline',
    'Main Vehicle': 'car-outline',
  };

  return (
    <ScreenBody>
      <SectionHeader>Inventory</SectionHeader>
      <View style={styles.inventoryHeader}>
        <TouchableOpacity
          style={styles.inventoryButton}
          onPress={() => navigation.navigate('InventoryAllItems')}
          accessibilityLabel="View All Items"
          accessibilityRole="button"
        >
          <Ionicons name="list-outline" size={30} color={COLORS.PRIMARY_DARK} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.inventoryButton}
          onPress={() => navigation.navigate('ManageInventoryCategories')}
          accessibilityLabel="Manage Categories"
          accessibilityRole="button"
        >
          <Ionicons
            name="folder-open-outline"
            size={30}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
      </View>
      <HorizontalRule />

      <Grid>
        {inventory.categories.map((cat) => (
          <CardTopic
            key={cat}
            title={cat}
            icon={categoryIcons[cat] || 'cube-outline'}
            onPress={() =>
              navigation.navigate('InventoryCategory', { category: cat })
            }
          />
        ))}
      </Grid>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  inventoryHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  inventoryButton: {
    paddingVertical: 6,
  },
});
