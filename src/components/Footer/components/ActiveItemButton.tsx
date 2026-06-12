import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { FlashlightModes } from '../../../../constants';
import { useTheme } from '../../../hooks/useTheme';
import { useSignalingStore } from '../../../stores/StoreContext';

interface ActiveItem {
  icon: string;
  label: string;
  mode?: string;
  type?: string;
}

/**
 * ActiveItemButton component displays and controls the currently active feature
 * (flashlight mode or decibel meter) or provides quick access to Nightvision.
 *
 * @remarks
 * - Shows the icon of the currently active feature
 * - Pressing turns off the active feature
 * - When no feature is active, shows Nightvision icon and navigates to Nightvision screen
 * - Decibel meter takes priority over flashlight modes when active
 *
 * @returns A React element rendering the active item button
 */
const ActiveItemButton = () => {
  const core = useSignalingStore();
  const navigation = useNavigation();
  const COLORS = useTheme();

  // Determine the active item based on flashlight mode or decibel meter
  const getActiveItem = (): ActiveItem | null => {
    // Decibel meter takes priority if active
    if (core.decibelMeterActive) {
      return {
        icon: 'volume-high-outline',
        label: 'Decibel Meter',
        type: 'decibel',
      };
    }

    const mode = core.flashlightMode;
    if (mode === FlashlightModes.ON) {
      return { icon: 'flashlight-outline', label: 'Flashlight', mode };
    }
    if (mode === FlashlightModes.STROBE) {
      return { icon: 'flash-outline', label: 'Strobe', mode };
    }
    if (mode === FlashlightModes.SOS) {
      return { icon: 'alert-outline', label: 'SOS', mode };
    }
    if (mode === FlashlightModes.NIGHTVISION) {
      return { icon: 'moon-outline', label: 'Nightvision', mode };
    }
    // No active item, show Nightvision as fallback
    return null;
  };

  const activeItem = getActiveItem();

  // Handle active item press (turn off or navigate to nightvision)
  const handlePress = () => {
    if (activeItem) {
      // Check if it's the decibel meter (has 'type' property)
      if (activeItem.type === 'decibel') {
        // Turn off the decibel meter
        core.setDecibelMeterActive(false);
      } else {
        // Turn off the active flashlight mode
        core.setFlashlightMode(FlashlightModes.OFF);
      }
    } else {
      // Navigate to Nightvision
      // @ts-ignore - navigation types
      navigation.navigate('Nightvision');
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        activeItem
          ? { backgroundColor: COLORS.ACCENT }
          : { backgroundColor: COLORS.PRIMARY_LIGHT },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      accessibilityLabel={
        activeItem ? `Turn off ${activeItem.label}` : 'Nightvision'
      }
      accessibilityRole="button"
    >
      <Ionicons
        name={activeItem ? activeItem.icon : 'moon-outline'}
        size={24}
        color={COLORS.PRIMARY_DARK}
      />
    </Pressable>
  );
};

export default observer(ActiveItemButton);

const styles = StyleSheet.create({
  container: {
    width: '25%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 2,
  },
  pressed: {
    opacity: 0.8,
  },
});
