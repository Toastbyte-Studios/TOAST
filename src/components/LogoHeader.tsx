import React from 'react';
import {
  Image,
  StyleSheet,
  ImageStyle,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { useTheme } from '../hooks/useTheme';

// Static requires: Metro resolves these at build time, so the paths cannot be
// interpolated. Both variants are bundled and the correct one is chosen at
// render time.
const LOGO_LIGHT = require('../../assets/coldboot-assets/png/light/icon-512.png');
const LOGO_DARK = require('../../assets/coldboot-assets/png/dark/icon-512.png');

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
  shadowStyle?: Partial<ViewStyle>;
};

/**
 * Renders the ColdBoot logo as a circular image with customizable size and style.
 *
 * The mark ships in a light and a dark variant; the active theme decides which
 * is shown. Each tile carries its own ground, so the circle is filled by the
 * artwork rather than by a themed background colour.
 *
 * @param size - The diameter of the logo in pixels. Defaults to 120.
 * @param style - Optional additional styles to apply to the logo image.
 * @param shadowStyle - Optional shadow styles to apply dynamic shadows (e.g., sun shadow).
 * @returns A React element displaying the ColdBoot logo.
 */
export default function LogoHeader({ size = 120, style, shadowStyle }: Props) {
  const COLORS = useTheme();
  const isDarkMode = useIsDarkMode();

  const containerStyle: StyleProp<ViewStyle> = [
    {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    shadowStyle,
  ];

  const imageStyle: StyleProp<ImageStyle> = [
    styles.base,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderColor: COLORS.BRAND,
    },
    style,
  ];

  return (
    <View style={containerStyle}>
      <Image
        source={isDarkMode ? LOGO_DARK : LOGO_LIGHT}
        style={imageStyle}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    resizeMode: 'cover',
    marginBottom: 10,
    borderWidth: 2,
  },
});
