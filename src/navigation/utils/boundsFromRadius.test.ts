import { boundsFromRadius } from './boundsFromRadius';

describe('boundsFromRadius', () => {
  it('returns symmetric bounds at the equator for a 50 mile radius', () => {
    const [west, south, east, north] = boundsFromRadius(
      { latitude: 0, longitude: 0 },
      50,
    );

    expect(south).toBeCloseTo(-0.7246, 3);
    expect(north).toBeCloseTo(0.7246, 3);
    expect(west).toBeCloseTo(-0.7246, 3);
    expect(east).toBeCloseTo(0.7246, 3);
  });

  it('returns expected deltas around Las Vegas with longitude delta > latitude delta', () => {
    const [west, south, east, north] = boundsFromRadius(
      { latitude: 36.17, longitude: -115.14 },
      50,
    );

    const latDelta = north - 36.17;
    const lngDelta = east - -115.14;

    expect(south).toBeCloseTo(36.17 - 0.7246, 3);
    expect(north).toBeCloseTo(36.17 + 0.7246, 3);
    expect(west).toBeCloseTo(-116.0373, 3);
    expect(east).toBeCloseTo(-114.2427, 3);
    expect(lngDelta).toBeGreaterThan(latDelta);
  });

  it('returns larger longitude delta at high latitudes', () => {
    const [west, south, east, north] = boundsFromRadius(
      { latitude: 70, longitude: 0 },
      50,
    );

    expect(south).toBeCloseTo(69.2754, 3);
    expect(north).toBeCloseTo(70.7246, 3);
    expect(west).toBeCloseTo(-2.1184, 3);
    expect(east).toBeCloseTo(2.1184, 3);
  });

  it('returns finite, clamped bounds near the pole', () => {
    const [west, south, east, north] = boundsFromRadius(
      { latitude: 89.5, longitude: 0 },
      50,
    );

    expect(west).toBe(-180);
    expect(east).toBe(180);
    expect(south).toBeCloseTo(88.7754, 3);
    expect(north).toBe(90);
    expect(Number.isFinite(south)).toBe(true);
    expect(Number.isFinite(north)).toBe(true);
  });

  it('clamps to full longitude span when bounds cross the antimeridian', () => {
    const [west, south, east, north] = boundsFromRadius(
      { latitude: 0, longitude: 179.9 },
      50,
    );

    expect(west).toBe(-180);
    expect(east).toBe(180);
    expect(south).toBeCloseTo(-0.7246, 3);
    expect(north).toBeCloseTo(0.7246, 3);
  });

  it('throws RangeError for zero radius', () => {
    expect(() => boundsFromRadius({ latitude: 0, longitude: 0 }, 0)).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for negative radius', () => {
    expect(() => boundsFromRadius({ latitude: 0, longitude: 0 }, -1)).toThrow(
      RangeError,
    );
  });
});
