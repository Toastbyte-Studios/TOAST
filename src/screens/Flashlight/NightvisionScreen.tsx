import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSignalingStore } from '../../stores/StoreContext';

/**
 * Full-screen Nightvision mode with red light at 100% brightness.
 *
 * @remarks
 * This screen displays a full-screen black background with a red overlay
 * at 100% brightness to preserve night vision.
 *
 * Users can navigate back using the standard swipe-back gesture to turn off
 * Nightvision mode.
 *
 * @returns A React element that renders the full-screen nightvision mode.
 */
const NightvisionScreenImpl = () => {
  const core = useSignalingStore();

  return (
    <View style={styles.container}>
      {/* Black background */}
      <View style={styles.blackBackground} />

      {/* Red overlay with 100% brightness */}
      <View
        style={[styles.redOverlay, { opacity: core.nightvisionBrightness }]}
      />
    </View>
  );
};

export default observer(NightvisionScreenImpl);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  blackBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  redOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ff0000', // Night-friendly dark red
  },
});
