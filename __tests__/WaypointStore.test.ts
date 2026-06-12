/**
 * @format
 * Tests for WaypointStore functionality
 */

jest.mock('react-native-sqlite-storage', () => {
  // Return null to force in-memory storage mode
  return null;
});

// Silence the expected "SQLite not available" warning in tests
jest.spyOn(console, 'warn').mockImplementation(() => {});

import { WaypointStore } from '../src/stores/WaypointStore';
import { SQLiteDatabase } from '../src/types/database-types';

describe('WaypointStore', () => {
  let store: WaypointStore;

  beforeEach(() => {
    store = new WaypointStore();
  });

  afterEach(() => {
    store.dispose();
  });

  describe('Initial state', () => {
    it('should initialize with empty waypoints', () => {
      expect(store.waypoints).toEqual([]);
    });

    it('should initialize with no active waypoint', () => {
      expect(store.activeWaypointId).toBeNull();
      expect(store.activeWaypoint).toBeNull();
    });

    it('should generate nextWaypointName as "Waypoint 1" when empty', () => {
      expect(store.nextWaypointName).toBe('Waypoint 1');
    });
  });

  describe('Adding waypoints', () => {
    it('should add a waypoint from coordinates', async () => {
      const wp = await store.addWaypoint('Base Camp', 37.7749, -122.4194);
      expect(wp.name).toBe('Base Camp');
      expect(wp.latitude).toBe(37.7749);
      expect(wp.longitude).toBe(-122.4194);
      expect(wp.id).toBeTruthy();
      expect(wp.createdAt).toBeTruthy();
      expect(store.waypoints).toHaveLength(1);
      expect(store.waypoints[0]).toEqual(wp);
    });

    it('should trim whitespace from name', async () => {
      const wp = await store.addWaypoint('  Alpha  ', 10, 20);
      expect(wp.name).toBe('Alpha');
    });

    it('should reject empty name', async () => {
      await expect(store.addWaypoint('   ', 10, 20)).rejects.toThrow(
        'Waypoint name cannot be empty',
      );
    });

    it('should increment nextWaypointName as waypoints are added', async () => {
      await store.addWaypoint('WP 1', 1, 2);
      expect(store.nextWaypointName).toBe('Waypoint 2');
      await store.addWaypoint('WP 2', 3, 4);
      expect(store.nextWaypointName).toBe('Waypoint 3');
    });

    it('should assign unique IDs to each waypoint', async () => {
      const wp1 = await store.addWaypoint('Alpha', 1, 1);
      const wp2 = await store.addWaypoint('Bravo', 2, 2);
      expect(wp1.id).not.toBe(wp2.id);
    });
  });

  describe('Deleting waypoints', () => {
    it('should delete a waypoint by ID', async () => {
      const wp = await store.addWaypoint('Test', 10, 20);
      await store.deleteWaypoint(wp.id);
      expect(store.waypoints).toHaveLength(0);
    });

    it('should only delete the specified waypoint', async () => {
      const wp1 = await store.addWaypoint('Alpha', 1, 1);
      const wp2 = await store.addWaypoint('Bravo', 2, 2);
      await store.deleteWaypoint(wp1.id);
      expect(store.waypoints).toHaveLength(1);
      expect(store.waypoints[0].id).toBe(wp2.id);
    });

    it('should clear active waypoint when its waypoint is deleted', async () => {
      const wp = await store.addWaypoint('Alpha', 1, 1);
      store.setActiveWaypoint(wp.id);
      expect(store.activeWaypointId).toBe(wp.id);
      await store.deleteWaypoint(wp.id);
      expect(store.activeWaypointId).toBeNull();
    });

    it('should not affect active waypoint when a different waypoint is deleted', async () => {
      const wp1 = await store.addWaypoint('Alpha', 1, 1);
      const wp2 = await store.addWaypoint('Bravo', 2, 2);
      store.setActiveWaypoint(wp2.id);
      await store.deleteWaypoint(wp1.id);
      expect(store.activeWaypointId).toBe(wp2.id);
    });
  });

  describe('Active waypoint', () => {
    it('should set the active waypoint', async () => {
      const wp = await store.addWaypoint('Target', 10, 20);
      store.setActiveWaypoint(wp.id);
      expect(store.activeWaypointId).toBe(wp.id);
      expect(store.activeWaypoint).toEqual(wp);
    });

    it('should clear the active waypoint', async () => {
      const wp = await store.addWaypoint('Target', 10, 20);
      store.setActiveWaypoint(wp.id);
      store.clearActiveWaypoint();
      expect(store.activeWaypointId).toBeNull();
      expect(store.activeWaypoint).toBeNull();
    });

    it('should return null for activeWaypoint if ID does not match any waypoint', () => {
      store.setActiveWaypoint('nonexistent-id');
      expect(store.activeWaypoint).toBeNull();
    });

    it('should allow setting active to null directly', async () => {
      const wp = await store.addWaypoint('Target', 10, 20);
      store.setActiveWaypoint(wp.id);
      store.setActiveWaypoint(null);
      expect(store.activeWaypointId).toBeNull();
    });
  });

  describe('Database initialisation without SQLite', () => {
    it('should initialise without error when no db is provided', async () => {
      // initDatabase with null db (SQLite not available)
      // The store should work in in-memory mode
      await expect(
        store.initDatabase(null as unknown as SQLiteDatabase),
      ).resolves.not.toThrow();
    });
  });
});
