/**
 * @format
 * Tests for TrackStore functionality
 */

jest.mock('react-native-sqlite-storage', () => {
  // Return null to force in-memory storage mode
  return null;
});

// Silence the expected "SQLite not available" warning in tests
jest.spyOn(console, 'warn').mockImplementation(() => {});

import { TrackStore, TrackPoint } from '../src/stores/TrackStore';
import { SQLiteDatabase } from '../src/types/database-types';

const samplePoints: TrackPoint[] = [
  { latitude: 37.0, longitude: -122.0, altitude: 10, timestamp: 1000 },
  { latitude: 37.001, longitude: -122.001, altitude: 11, timestamp: 6000 },
  { latitude: 37.002, longitude: -122.002, altitude: 12, timestamp: 11000 },
];

describe('TrackStore', () => {
  let store: TrackStore;

  beforeEach(() => {
    store = new TrackStore();
  });

  afterEach(() => {
    store.dispose();
  });

  describe('Initial state', () => {
    it('should initialize with empty tracks list', () => {
      expect(store.tracks).toEqual([]);
    });
  });

  describe('Saving tracks', () => {
    it('should save a track and add it to the list', async () => {
      const track = await store.saveTrack(
        'Morning Run',
        120,
        500,
        samplePoints,
      );
      expect(track.name).toBe('Morning Run');
      expect(track.durationSeconds).toBe(120);
      expect(track.distanceMeters).toBe(500);
      expect(track.points).toEqual(samplePoints);
      expect(track.id).toBeTruthy();
      expect(track.createdAt).toBeTruthy();
      expect(store.tracks).toHaveLength(1);
      expect(store.tracks[0]).toEqual(track);
    });

    it('should trim whitespace from track name', async () => {
      const track = await store.saveTrack(
        '  Trail Run  ',
        60,
        200,
        samplePoints,
      );
      expect(track.name).toBe('Trail Run');
    });

    it('should use a default name when name is empty', async () => {
      const track = await store.saveTrack('', 60, 200, samplePoints);
      expect(track.name).toMatch(/^Track \d{4}-\d{2}-\d{2}/);
    });

    it('should use a default name when name is whitespace only', async () => {
      const track = await store.saveTrack('   ', 60, 200, samplePoints);
      expect(track.name).toMatch(/^Track /);
    });

    it('should assign unique IDs to each track', async () => {
      const t1 = await store.saveTrack('Alpha', 60, 200, samplePoints);
      const t2 = await store.saveTrack('Bravo', 120, 400, samplePoints);
      expect(t1.id).not.toBe(t2.id);
    });

    it('should prepend new tracks so the most recent is first', async () => {
      await store.saveTrack('Older', 60, 100, samplePoints);
      await store.saveTrack('Newer', 120, 200, samplePoints);
      expect(store.tracks[0].name).toBe('Newer');
      expect(store.tracks[1].name).toBe('Older');
    });
  });

  describe('Deleting tracks', () => {
    it('should delete a track by ID', async () => {
      const track = await store.saveTrack('Test', 60, 200, samplePoints);
      await store.deleteTrack(track.id);
      expect(store.tracks).toHaveLength(0);
    });

    it('should only delete the specified track', async () => {
      const t1 = await store.saveTrack('Alpha', 60, 100, samplePoints);
      const t2 = await store.saveTrack('Bravo', 120, 200, samplePoints);
      await store.deleteTrack(t1.id);
      expect(store.tracks).toHaveLength(1);
      expect(store.tracks[0].id).toBe(t2.id);
    });

    it('should not throw when deleting a non-existent ID', async () => {
      await expect(store.deleteTrack('nonexistent-id')).resolves.not.toThrow();
    });
  });

  describe('Database initialisation without SQLite', () => {
    it('should initialise without error when no db is provided', async () => {
      await expect(
        store.initDatabase(null as unknown as SQLiteDatabase),
      ).resolves.not.toThrow();
    });

    it('should operate in in-memory mode after failed db init', async () => {
      await store.initDatabase(null as unknown as SQLiteDatabase);
      const track = await store.saveTrack('Test', 30, 100, samplePoints);
      expect(track.name).toBe('Test');
      expect(store.tracks).toHaveLength(1);
    });
  });
});
