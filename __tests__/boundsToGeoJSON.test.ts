import { boundsToGeoJSON } from '../src/navigation/utils/boundsToGeoJSON';

const LV_BOUNDS: [number, number, number, number] = [
  -116.42, 35.45, -113.85, 36.89,
];

describe('boundsToGeoJSON', () => {
  it('returns a Feature<Polygon>', () => {
    const result = boundsToGeoJSON(LV_BOUNDS);
    expect(result.type).toBe('Feature');
    expect(result.geometry.type).toBe('Polygon');
  });

  it('ring has exactly 5 positions', () => {
    const { coordinates } = boundsToGeoJSON(LV_BOUNDS).geometry;
    expect(coordinates[0]).toHaveLength(5);
  });

  it('ring is closed (first and last position are equal)', () => {
    const ring = boundsToGeoJSON(LV_BOUNDS).geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('winds NE → NW → SW → SE → NE', () => {
    const [west, south, east, north] = LV_BOUNDS;
    const ring = boundsToGeoJSON(LV_BOUNDS).geometry.coordinates[0];
    expect(ring[0]).toEqual([east, north]); // NE
    expect(ring[1]).toEqual([west, north]); // NW
    expect(ring[2]).toEqual([west, south]); // SW
    expect(ring[3]).toEqual([east, south]); // SE
    expect(ring[4]).toEqual([east, north]); // NE (close)
  });

  it('covers all four corners of the bounds', () => {
    const [west, south, east, north] = LV_BOUNDS;
    const ring = boundsToGeoJSON(LV_BOUNDS).geometry.coordinates[0];
    const lngs = ring.map(([lng]) => lng);
    const lats = ring.map(([, lat]) => lat);
    expect(lngs).toContain(west);
    expect(lngs).toContain(east);
    expect(lats).toContain(south);
    expect(lats).toContain(north);
  });

  it('returns empty properties object', () => {
    expect(boundsToGeoJSON(LV_BOUNDS).properties).toEqual({});
  });
});
