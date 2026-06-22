const MILES_PER_DEGREE_LAT = 69.0;
const POLE_GUARD_DEGREES = 89;

type Coordinate = {
  longitude: number;
  latitude: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Convert a GPS center point and radius in miles into a lat/lng bounding box
 * suitable for MapLibre's OfflineManager.createPack bounds parameter.
 *
 * Returns [west, south, east, north] in degrees.
 *
 * Note: this is a rectangular bounding box that contains a circle of the given
 * radius — the corners are further than `radiusMiles` from the center. This is
 * the desired behavior for offline tile downloads, where we want to fully cover
 * the area the user might wander into.
 *
 * Antimeridian behavior: if bounds would cross ±180° longitude, this function
 * returns the full longitude span [-180, 180] because createPack expects a
 * single rectangular bounds and does not accept split antimeridian bounds.
 *
 * Polar behavior: when within ~1° of either pole, longitude becomes unstable
 * (cos(latitude) approaches 0), so this function returns the full longitude
 * span [-180, 180] and clamps latitude to the valid [-90, 90] range.
 *
 * @throws {RangeError} When radiusMiles is zero, negative, or non-finite.
 */
export function boundsFromRadius(
  center: Coordinate,
  radiusMiles: number,
): [west: number, south: number, east: number, north: number] {
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
    throw new RangeError(
      'radiusMiles must be a positive, finite number greater than 0',
    );
  }

  const { latitude, longitude } = center;
  const deltaLat = radiusMiles / MILES_PER_DEGREE_LAT;
  const absLatitude = Math.abs(latitude);

  const useFullLongitudeRange = absLatitude >= POLE_GUARD_DEGREES;
  let deltaLng = 180;

  if (!useFullLongitudeRange) {
    const cosLat = Math.cos((latitude * Math.PI) / 180);

    if (Math.abs(cosLat) > Number.EPSILON) {
      deltaLng = clamp(
        radiusMiles / (MILES_PER_DEGREE_LAT * cosLat),
        -180,
        180,
      );
    }
  }

  const south = clamp(latitude - deltaLat, -90, 90);
  const north = clamp(latitude + deltaLat, -90, 90);

  if (useFullLongitudeRange) {
    return [-180, south, 180, north];
  }

  const west = longitude - deltaLng;
  const east = longitude + deltaLng;

  if (west < -180 || east > 180) {
    return [-180, south, 180, north];
  }

  return [west, south, east, north];
}
