import { boundsFromRadius } from '../src/navigation/utils/boundsFromRadius';

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
    const centerLng = -115.14;
    const [west, south, east, north] = boundsFromRadius(
      { latitude: 36.17, longitude: centerLng },
      50,
    );

    const latDelta = north - 36.17;
    const lngDelta = east - centerLng;

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

  it('returns full longitude span when a large radius causes bounds to touch a pole', () => {
    // Center at 88° with a 300-mile radius: north = 88 + 300/69 ≈ 92.3, clamped to 90.
    const [west, _south, east, north] = boundsFromRadius(
      { latitude: 88, longitude: 0 },
      300,
    );

    expect(west).toBe(-180);
    expect(east).toBe(180);
    expect(north).toBe(90);
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

  it('throws RangeError for NaN radius', () => {
    expect(() => boundsFromRadius({ latitude: 0, longitude: 0 }, NaN)).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for Infinity radius', () => {
    expect(() =>
      boundsFromRadius({ latitude: 0, longitude: 0 }, Infinity),
    ).toThrow(RangeError);
  });

  it('throws RangeError for -Infinity radius', () => {
    expect(() =>
      boundsFromRadius({ latitude: 0, longitude: 0 }, -Infinity),
    ).toThrow(RangeError);
  });

  it('throws RangeError for non-finite center latitude', () => {
    expect(() => boundsFromRadius({ latitude: NaN, longitude: 0 }, 50)).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for out-of-range center latitude', () => {
    expect(() => boundsFromRadius({ latitude: 91, longitude: 0 }, 50)).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for non-finite center longitude', () => {
    expect(() => boundsFromRadius({ latitude: 0, longitude: NaN }, 50)).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for out-of-range center longitude', () => {
    expect(() => boundsFromRadius({ latitude: 0, longitude: 181 }, 50)).toThrow(
      RangeError,
    );
  });
});
