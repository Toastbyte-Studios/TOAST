/**
 * MapSpikeScreen — DEV ONLY throwaway screen.
 *
 * Validates the MapLibre v11 + OpenFreeMap stack on both platforms before the
 * production navigation migration lands.  This file should be deleted once the
 * migration is complete (see Toastbyte-Studios/TOAST#235).
 *
 * @format
 */

import { Camera, Map } from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** OpenFreeMap Liberty style — free, OSM-backed, no API key required. */
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Spike screen that renders an OpenFreeMap-backed MapLibre map centred on Las
 * Vegas.  Confirms pan, pinch-zoom, double-tap zoom, and rotate all work, and
 * that OpenFreeMap + OSM attribution is visible on the map.
 *
 * Gated behind `__DEV__` — this screen must not appear in production builds.
 */
export default function MapSpikeScreen() {
  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE}
        attribution
        compass
        logo={false}
      >
        <Camera
          initialViewState={{
            center: [-115.1398, 36.1699],
            zoom: 10,
          }}
        />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
