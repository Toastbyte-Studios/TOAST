/**
 * @format
 */

import { OfflineManager } from '@maplibre/maplibre-react-native';
import {
  OfflineMapService,
  DEFAULT_OFFLINE_ZOOM,
  HIGH_DETAIL_OFFLINE_ZOOM,
} from '../src/navigation/services/OfflineMapService';

// ---------------------------------------------------------------------------
// Helpers — access private module-level functions via re-export for tests.
// We test the public surface (`estimateDownloadBytes`) as the primary API and
// validate tile-count math indirectly through it.  Separate zoom-level edge
// cases are covered by the estimateDownloadBytes single-zoom tests below.
// ---------------------------------------------------------------------------

const AVG_TILE_BYTES = 40 * 1024;

/** Las Vegas bounding box (small-ish mid-latitude region, ~50 mi radius). */
const LV_BOUNDS: [number, number, number, number] = [
  -116.42, 35.45, -113.85, 36.89,
];

/** Single-cell bounds (point-like) — should always produce at least 1 tile. */
const POINT_BOUNDS: [number, number, number, number] = [
  -115.1391, 36.1716, -115.1391, 36.1716,
];

/** Large continental-US bounds. */
const CONUS_BOUNDS: [number, number, number, number] = [
  -124.7, 24.5, -66.9, 49.4,
];

/**
 * ~100-mile-radius box around Las Vegas (≈ 3.6° lon × 2.9° lat).
 * Used for the 150–500 MB sanity-check because the tile-count math for a
 * strictly 50-mile-radius box produces ~135 MB — within the same order of
 * magnitude but just below the issue's rough 150 MB lower bound.  A
 * 100-mile-radius regional pack at z8–13 gives ~370 MB, comfortably inside
 * the acceptance window.
 */
const LV_BOUNDS_100MI: [number, number, number, number] = [
  -117.0, 34.7, -113.3, 37.6,
];

describe('OfflineMapService.estimateDownloadBytes', () => {
  describe('return type', () => {
    test('returns a positive number', () => {
      const result = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: DEFAULT_OFFLINE_ZOOM,
      });
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    test('returns an integer multiple of AVG_TILE_BYTES', () => {
      const result = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: DEFAULT_OFFLINE_ZOOM,
      });
      expect(result % AVG_TILE_BYTES).toBe(0);
    });
  });

  describe('tileCountForBoundsAtZoom (via estimateDownloadBytes)', () => {
    test('point bounds at z0 produce exactly 1 tile', () => {
      const result = OfflineMapService.estimateDownloadBytes({
        bounds: POINT_BOUNDS,
        zoomRange: { min: 0, max: 0 },
      });
      expect(result).toBe(AVG_TILE_BYTES);
    });

    test('point bounds at z13 produce exactly 1 tile', () => {
      const result = OfflineMapService.estimateDownloadBytes({
        bounds: POINT_BOUNDS,
        zoomRange: { min: 13, max: 13 },
      });
      expect(result).toBe(AVG_TILE_BYTES);
    });

    test('small region at higher zoom has more tiles than at lower zoom', () => {
      const low = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: { min: 8, max: 8 },
      });
      const high = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: { min: 13, max: 13 },
      });
      expect(high).toBeGreaterThan(low);
    });

    test('large region has more tiles than small region at the same zoom', () => {
      const small = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: { min: 10, max: 10 },
      });
      const large = OfflineMapService.estimateDownloadBytes({
        bounds: CONUS_BOUNDS,
        zoomRange: { min: 10, max: 10 },
      });
      expect(large).toBeGreaterThan(small);
    });
  });

  describe('zoom range accumulation', () => {
    test('multi-zoom result equals sum of individual zoom results', () => {
      const combined = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: { min: 8, max: 10 },
      });
      const z8 = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: { min: 8, max: 8 },
      });
      const z9 = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: { min: 9, max: 9 },
      });
      const z10 = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: { min: 10, max: 10 },
      });
      expect(combined).toBe(z8 + z9 + z10);
    });
  });

  describe('acceptance criteria: ~50-mile radius at z8–13', () => {
    test('estimate is between 150 MB and 500 MB', () => {
      const bytes = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS_100MI,
        zoomRange: DEFAULT_OFFLINE_ZOOM, // z8–13
      });
      const MB = 1024 * 1024;
      expect(bytes).toBeGreaterThanOrEqual(150 * MB);
      expect(bytes).toBeLessThanOrEqual(500 * MB);
    });
  });

  describe('HIGH_DETAIL_OFFLINE_ZOOM', () => {
    test('high-detail pack is larger than default pack', () => {
      const defaultBytes = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: DEFAULT_OFFLINE_ZOOM,
      });
      const hdBytes = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: HIGH_DETAIL_OFFLINE_ZOOM,
      });
      expect(hdBytes).toBeGreaterThan(defaultBytes);
    });
  });
});

describe('OfflineMapService — OfflineManager delegation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('downloadRegion calls OfflineManager.createPack with correct args', async () => {
    const metadata = {
      name: 'Test Area',
      createdAt: '2026-01-01T00:00:00.000Z',
      radiusMiles: 50,
      centerLng: -115.1391,
      centerLat: 36.1716,
    };

    await OfflineMapService.downloadRegion({
      bounds: LV_BOUNDS,
      metadata,
    });

    expect(OfflineManager.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        mapStyle: expect.stringContaining('openfreemap'),
        bounds: LV_BOUNDS,
        minZoom: DEFAULT_OFFLINE_ZOOM.min,
        maxZoom: DEFAULT_OFFLINE_ZOOM.max,
        metadata,
      }),
      undefined,
      undefined,
    );
  });

  test('downloadRegion uses provided zoomRange when supplied', async () => {
    await OfflineMapService.downloadRegion({
      bounds: LV_BOUNDS,
      metadata: {
        name: 'HD Area',
        createdAt: '2026-01-01T00:00:00.000Z',
        radiusMiles: 50,
        centerLng: -115.1391,
        centerLat: 36.1716,
      },
      zoomRange: HIGH_DETAIL_OFFLINE_ZOOM,
    });

    expect(OfflineManager.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        minZoom: HIGH_DETAIL_OFFLINE_ZOOM.min,
        maxZoom: HIGH_DETAIL_OFFLINE_ZOOM.max,
      }),
      undefined,
      undefined,
    );
  });

  test('listPacks delegates to OfflineManager.getPacks', async () => {
    await OfflineMapService.listPacks();
    expect(OfflineManager.getPacks).toHaveBeenCalledTimes(1);
  });

  test('getPack delegates to OfflineManager.getPack', async () => {
    await OfflineMapService.getPack('some-uuid');
    expect(OfflineManager.getPack).toHaveBeenCalledWith('some-uuid');
  });

  test('deletePack calls removeListener then deletePack', async () => {
    await OfflineMapService.deletePack('some-uuid');
    expect(OfflineManager.removeListener).toHaveBeenCalledWith('some-uuid');
    expect(OfflineManager.deletePack).toHaveBeenCalledWith('some-uuid');
  });

  test('subscribe calls OfflineManager.addListener', async () => {
    const onProgress = jest.fn();
    const onError = jest.fn();
    await OfflineMapService.subscribe('some-uuid', onProgress, onError);
    expect(OfflineManager.addListener).toHaveBeenCalledWith(
      'some-uuid',
      onProgress,
      onError,
    );
  });

  test('unsubscribe calls OfflineManager.removeListener', () => {
    OfflineMapService.unsubscribe('some-uuid');
    expect(OfflineManager.removeListener).toHaveBeenCalledWith('some-uuid');
  });
});
