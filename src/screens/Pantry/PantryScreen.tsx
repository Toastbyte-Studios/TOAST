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
import { usePantryStore } from '../../stores';

/**
 * Pantry landing screen.
 *
 * @remarks
 * Presents a dashboard of pantry-related actions and routes:
 * - **View All** → navigates to the `PantryAllItems` screen showing all items alphabetically
 * - **Manage Categories** → navigates to the `ManagePantryCategories` screen
 * - **Pantry Categories** → mapped as CardTopic cards that navigate to category-specific screens
 *
 * Uses React Navigation to perform screen transitions from card taps.
 *
 * @returns A screen layout containing a header, action buttons, and a grid of navigation cards.
 */
export default observer(function PantryScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const pantry = usePantryStore();
  const COLORS = useTheme();

  const categoryIcons: Record<string, string> = {
    'Canned Goods': 'flask-outline',
    'Dry Goods': 'nutrition-outline',
    Frozen: 'snow-outline',
    Fresh: 'leaf-outline',
  };

  return (
    <ScreenBody>
      <SectionHeader>Pantry</SectionHeader>
      <View style={styles.pantryHeader}>
        <TouchableOpacity
          style={styles.pantryButton}
          onPress={() => navigation.navigate('PantryAllItems')}
          accessibilityLabel="View All Items"
          accessibilityRole="button"
        >
          <Ionicons name="list-outline" size={30} color={COLORS.PRIMARY_DARK} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pantryButton}
          onPress={() => navigation.navigate('PantryExpirationTracker')}
          accessibilityLabel="Expiration Tracker"
          accessibilityRole="button"
        >
          <Ionicons name="time-outline" size={30} color={COLORS.PRIMARY_DARK} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pantryButton}
          onPress={() => navigation.navigate('ManagePantryCategories')}
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
        {pantry.categories.map((cat) => (
          <CardTopic
            key={cat}
            title={cat}
            icon={categoryIcons[cat] || 'restaurant-outline'}
            onPress={() =>
              navigation.navigate('PantryCategory', { category: cat })
            }
          />
        ))}
      </Grid>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  pantryHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  pantryButton: {
    paddingVertical: 6,
  },
});
