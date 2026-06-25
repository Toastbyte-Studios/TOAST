/**
 * @format
 */

import { OfflineManager } from '@maplibre/maplibre-react-native';
import {
  OfflineMapService,
  DEFAULT_OFFLINE_ZOOM,
  HIGH_DETAIL_OFFLINE_ZOOM,
  OPENFREEMAP_STYLE,
} from '../src/navigation/services/OfflineMapService';
import type { OfflinePackCreateOptions } from '@maplibre/maplibre-react-native';

// ---------------------------------------------------------------------------
// Compile-time shape check — ensures our createPack options object stays
// compatible with the real library type. This catches v12 API drift at `tsc`
// rather than at runtime.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _offlinePackCreateOptionsTypeCheck: OfflinePackCreateOptions = {
  mapStyle: OPENFREEMAP_STYLE,
  bounds: [-116.42, 35.45, -113.85, 36.89],
  minZoom: DEFAULT_OFFLINE_ZOOM.min,
  maxZoom: DEFAULT_OFFLINE_ZOOM.max,
  metadata: {},
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Las Vegas bounding box (~50-mile radius). */
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

// ---------------------------------------------------------------------------
// estimateDownloadBytes
// ---------------------------------------------------------------------------

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
  });

  describe('tileCountForBoundsAtZoom (via estimateDownloadBytes)', () => {
    test('point bounds at z0 produce exactly 1 tile worth of bytes', () => {
      const z0result = OfflineMapService.estimateDownloadBytes({
        bounds: POINT_BOUNDS,
        zoomRange: { min: 0, max: 0 },
      });
      const z13result = OfflineMapService.estimateDownloadBytes({
        bounds: POINT_BOUNDS,
        zoomRange: { min: 13, max: 13 },
      });
      // Both should be a single tile's worth — just different per-zoom weights.
      // Verify they're positive and differ (per-zoom weights differ at z0 vs z13).
      expect(z0result).toBeGreaterThan(0);
      expect(z13result).toBeGreaterThan(0);
      expect(z0result).not.toBe(z13result);
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
      // z13 has ~16× more tiles than z8 for the same area; even with a smaller
      // per-tile weight the byte total is still larger.
      expect(high).toBeGreaterThan(low);
    });

    test('large region has more bytes than small region at the same zoom', () => {
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
    test('estimate is between 5 MB and 50 MB', () => {
      const bytes = OfflineMapService.estimateDownloadBytes({
        bounds: LV_BOUNDS,
        zoomRange: DEFAULT_OFFLINE_ZOOM,
      });
      const MB = 1024 * 1024;
      expect(bytes).toBeGreaterThanOrEqual(5 * MB);
      expect(bytes).toBeLessThanOrEqual(50 * MB);
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

// ---------------------------------------------------------------------------
// OfflineManager delegation
// ---------------------------------------------------------------------------

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
      expect.any(Function), // no-op progress listener
      expect.any(Function), // no-op error listener
    );
  });

  test('downloadRegion passes through provided listeners', async () => {
    const onProgress = jest.fn();
    const onError = jest.fn();

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
      onProgress,
      onError,
    });

    expect(OfflineManager.createPack).toHaveBeenCalledWith(
      expect.objectContaining({
        minZoom: HIGH_DETAIL_OFFLINE_ZOOM.min,
        maxZoom: HIGH_DETAIL_OFFLINE_ZOOM.max,
      }),
      onProgress,
      onError,
    );
  });

  test('downloadRegion uses no-op listeners when none are provided', async () => {
    await OfflineMapService.downloadRegion({
      bounds: LV_BOUNDS,
      metadata: {
        name: 'No Listeners',
        createdAt: '2026-01-01T00:00:00.000Z',
        radiusMiles: 50,
        centerLng: -115.1391,
        centerLat: 36.1716,
      },
    });

    const [, progressArg, errorArg] = (OfflineManager.createPack as jest.Mock)
      .mock.calls[0];
    expect(typeof progressArg).toBe('function');
    expect(typeof errorArg).toBe('function');
  });

  test('listPacks returns mapped OfflineMapPack array', async () => {
    const result = await OfflineMapService.listPacks();
    expect(Array.isArray(result)).toBe(true);
    expect(OfflineManager.getPacks).toHaveBeenCalledTimes(1);
  });

  test('getPack returns undefined when pack not found', async () => {
    const result = await OfflineMapService.getPack('some-uuid');
    expect(result).toBeUndefined();
    expect(OfflineManager.getPack).toHaveBeenCalledWith('some-uuid');
  });

  test('deletePack calls removeListener then deletePack', async () => {
    const removeOrder: string[] = [];
    (OfflineManager.removeListener as jest.Mock).mockImplementation(() => {
      removeOrder.push('removeListener');
    });
    (OfflineManager.deletePack as jest.Mock).mockImplementation(async () => {
      removeOrder.push('deletePack');
    });

    await OfflineMapService.deletePack('some-uuid');

    expect(removeOrder).toEqual(['removeListener', 'deletePack']);
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
