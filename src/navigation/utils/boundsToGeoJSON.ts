import type { Feature, Polygon } from 'geojson';

/**
 * Converts a flat [west, south, east, north] bounding box into a GeoJSON
 * Feature<Polygon> with a closed 5-point ring wound NE→NW→SW→SE→NE.
 *
 * Note: does not handle antimeridian-crossing bounds (fine for US-only use).
 */
export function boundsToGeoJSON(
  bounds: [west: number, south: number, east: number, north: number],
): Feature<Polygon> {
  const [west, south, east, north] = bounds;
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [east, north], // NE
          [west, north], // NW
          [west, south], // SW
          [east, south], // SE
          [east, north], // NE (close ring)
        ],
      ],
    },
    properties: {},
  };
}
