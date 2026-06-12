import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useSignalingStore } from '../../../stores/StoreContext';

/**
 * DecibelMeterVisualization component displays a visual bar graph
 * representing the current decibel level from the decibel meter.
 *
 * @remarks
 * - Shows 10 bars representing levels from 10dB to 100dB
 * - Bars are color-coded: green (<40dB), yellow (40-70dB), red (>70dB)
 * - Bar heights scale progressively from 4px to 40px
 * - Inactive bars are shown with reduced opacity
 *
 * @returns A React element rendering the decibel meter visualization
 */
const DecibelMeterVisualization = () => {
  const core = useSignalingStore();
  const COLORS = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.barsContainer}>
        {[...Array(10)].map((_, i) => {
          const barLevel = (i + 1) * 10; // Each bar represents 10 dB
          const isBarActive = core.currentDecibelLevel >= barLevel;
          const barColor =
            barLevel < 40
              ? COLORS.SUCCESS
              : barLevel < 70
                ? COLORS.ACCENT
                : COLORS.ERROR;
          const barHeight = ((i + 1) / 10) * 40; // Height scales from 4px to 40px

          return (
            <View
              key={i}
              style={[
                styles.bar,
                isBarActive ? styles.barActive : styles.barInactive,
                {
                  height: barHeight,
                  backgroundColor: isBarActive ? barColor : COLORS.BACKGROUND,
                  borderColor: COLORS.SECONDARY_ACCENT,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

export default observer(DecibelMeterVisualization);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
    gap: 2,
  },
  bar: {
    width: 6,
    borderRadius: 2,
    borderWidth: 1,
    // Height is set dynamically based on bar level
  },
  barActive: {
    opacity: 1,
  },
  barInactive: {
    opacity: 0.3,
  },
});
