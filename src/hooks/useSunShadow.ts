import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SunCalc from 'suncalc';
import { useCoreStore, useSettingsStore } from '../stores/StoreContext';
import { useTheme } from './useTheme';

interface SunShadowStyle {
  shadowColor: string;
  shadowOffset: {
    width: number;
    height: number;
  };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/**
 * Custom hook that calculates shadow properties based on the sun's position.
 *
 * The shadow simulates how the sun casts shadows throughout the day:
 * - Sun rises in the east: shadow extends to the left (west)
 * - Sun at noon: shadow extends downward
 * - Sun sets in the west: shadow extends to the right (east)
 *
 * Shadow intensity (opacity) varies based on sun altitude:
 * - Dawn/dusk: faint shadow (low altitude)
 * - Solar noon: intense shadow (high altitude)
 *
 * @returns Shadow style object with shadowColor, shadowOffset, shadowOpacity, shadowRadius, and elevation
 */
export function useSunShadow(): SunShadowStyle {
  const core = useCoreStore();
  const theme = useTheme();
  const settingsStore = useSettingsStore();
  const systemColorScheme = useColorScheme();

  // Determine if dark mode based on themeMode setting and system preference
  const isDarkMode =
    settingsStore.themeMode === 'dark' ||
    (settingsStore.themeMode === 'system' && systemColorScheme === 'dark');
  const shadowColor = isDarkMode ? theme.BRAND : theme.PRIMARY_DARK;

  const [shadowStyle, setShadowStyle] = useState<SunShadowStyle>({
    shadowColor: shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  });

  useEffect(() => {
    const updateShadow = () => {
      // Get current location
      if (!core.lastFix) {
        // No location available, use default shadow (straight down)
        setShadowStyle({
          shadowColor: shadowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        });
        return;
      }

      const { latitude, longitude } = core.lastFix.coords;
      const now = new Date();

      // Get sun position (altitude and azimuth)
      const sunPosition = SunCalc.getPosition(now, latitude, longitude);

      // altitude: angle above/below horizon in radians (-π/2 to π/2)
      // azimuth: direction in radians from south (-π to π, 0 = south, negative = east of south, positive = west of south)
      const altitude = sunPosition.altitude;
      const azimuth = sunPosition.azimuth;

      // Convert altitude to degrees for easier calculation
      const altitudeDeg = altitude * (180 / Math.PI);

      // Calculate shadow opacity based on altitude
      // At 0° (horizon): opacity = 0.1 (faint)
      // At 90° (zenith): opacity = 0.6 (intense)
      // Below horizon (night): opacity = 0
      let opacity = 0;
      if (altitudeDeg > 0) {
        // Map 0-90 degrees to 0.1-0.6 opacity
        opacity = 0.1 + (altitudeDeg / 90) * 0.5;
        opacity = Math.min(0.6, Math.max(0.1, opacity));
      }

      // Calculate shadow offset based on azimuth
      // Azimuth is measured from south to west (suncalc convention)
      // 0 = south, π/2 = west, π = north, -π/2 = east
      // We want the shadow to be opposite to the sun's direction
      //
      // Sun in east (azimuth ≈ -π/2): shadow to west (left, negative x)
      // Sun in south (azimuth ≈ 0): shadow downward (positive y)
      // Sun in west (azimuth ≈ π/2): shadow to east (right, positive x)

      // Shadow direction is opposite to sun
      const shadowAngle = azimuth + Math.PI;

      // Calculate shadow length based on altitude (lower sun = longer shadow)
      // At 5° altitude: max shadow length (20)
      // At 90° altitude: min shadow length (5)
      const baseLength =
        altitudeDeg > 0 ? Math.max(5, 20 - (altitudeDeg / 90) * 15) : 0;

      // Calculate shadow offset
      // Note: Y-axis is inverted (negative cos instead of positive) to make
      // shadows extend downward when sun is high (azimuth ≈ 0)
      const shadowX = -Math.sin(shadowAngle) * baseLength;
      const shadowY = -Math.cos(shadowAngle) * baseLength;

      // Calculate shadow blur based on altitude (higher sun = sharper shadow)
      const shadowRadius =
        altitudeDeg > 0 ? Math.max(4, 12 - (altitudeDeg / 90) * 8) : 4;

      // Calculate elevation for Android (based on opacity for consistency)
      // Opacity ranges from 0-0.6, so elevation ranges from 0-9
      const elevation = opacity * 15;

      setShadowStyle({
        shadowColor: shadowColor,
        shadowOffset: {
          width: shadowX,
          height: shadowY,
        },
        shadowOpacity: opacity,
        shadowRadius: shadowRadius,
        elevation: elevation,
      });
    };

    // Update immediately when location changes
    updateShadow();

    // Note: No interval needed here. The shadow updates whenever core.lastFix changes,
    // which happens approximately every 60 seconds when GPS updates.
    // This is sufficient since sun position changes slowly.
  }, [
    core.lastFix,
    shadowColor,
    settingsStore.themeMode,
    systemColorScheme,
    theme,
  ]);

  return shadowStyle;
}
