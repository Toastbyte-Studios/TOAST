import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';

type Props = {
  onPress: () => void;
  permissionGranted: boolean;
};

/**
 * On-map button that opens the offline download confirmation flow.
 * Rendered inside MapPanel alongside the existing waypoints/record/locate buttons.
 * Disabled (with tooltip) when location permission is not granted.
 */
export default function DownloadAreaButton({
  onPress,
  permissionGranted,
}: Props) {
  const COLORS = useTheme();

  if (!permissionGranted) {
    return (
      <View
        style={[
          styles.button,
          styles.buttonDisabled,
          { backgroundColor: COLORS.SECONDARY_ACCENT },
        ]}
        accessibilityLabel="Download your area — enable location to use this feature"
        accessibilityHint="Location permission is required to download an offline map"
      >
        <Text style={[styles.icon, { color: COLORS.PRIMARY_LIGHT }]}>⤓</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: COLORS.SECONDARY_ACCENT }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel="Download your area"
      accessibilityHint="Downloads an offline map centred on your current location"
      accessibilityRole="button"
    >
      <Text style={[styles.icon, { color: COLORS.PRIMARY_LIGHT }]}>⤓</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  icon: {
    fontSize: 22,
    lineHeight: 26,
  },
});
