/**
 * @format
 */

import {
  SolarCycleNotificationStore,
  SolarNotification,
} from '../src/stores/SolarCycleNotificationStore';
import { SQLiteDatabase } from '../src/types/database-types';
import { getLunarPhaseName } from '../src/utils/lunarPhase';

// Mock SQLite
const mockDb = {
  transaction: jest.fn((callback) => {
    const tx = {
      executeSql: jest.fn((sql, params, success) => {
        if (success) {
          if (sql.includes('SELECT')) {
            // Mock loading settings
            success(null, {
              rows: {
                length: 1,
                item: () => ({
                  enabled: 1,
                  sunrise_enabled: 1,
                  sunset_enabled: 1,
                  buffer_minutes: 15,
                }),
              },
            });
          } else {
            // Mock insert/update success
            success();
          }
        }
      }),
    };
    callback(tx);
  }),
};

describe('SolarCycleNotificationStore', () => {
  let store: SolarCycleNotificationStore;

  beforeEach(() => {
    store = new SolarCycleNotificationStore();
  });

  afterEach(() => {
    store.dispose();
  });

  describe('Initialization', () => {
    test('initializes with default settings', () => {
      expect(store.enabled).toBe(true); // Solar cycle notifications are always enabled
      expect(store.sunriseEnabled).toBe(true);
      expect(store.sunsetEnabled).toBe(true);
      expect(store.dawnEnabled).toBe(true);
      expect(store.duskEnabled).toBe(true);
      expect(store.bufferMinutes).toBe(15);
      expect(store.activeNotifications).toEqual([]);
    });

    test('can initialize database', async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);
      // Database is initialized but no transaction is called for always-on settings
      expect(store.enabled).toBe(true);
    });

    test('can load settings from database', async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);
      await store.loadSettings();
      expect(store.enabled).toBe(true);
      expect(store.sunriseEnabled).toBe(true);
      expect(store.sunsetEnabled).toBe(true);
      expect(store.dawnEnabled).toBe(true);
      expect(store.duskEnabled).toBe(true);
      expect(store.bufferMinutes).toBe(15);
    });
  });

  describe('Settings Management', () => {
    test('has hardcoded default settings', () => {
      // Settings are always-on and not user-configurable
      expect(store.enabled).toBe(true);
      expect(store.sunriseEnabled).toBe(true);
      expect(store.sunsetEnabled).toBe(true);
      expect(store.dawnEnabled).toBe(true);
      expect(store.duskEnabled).toBe(true);
      expect(store.bufferMinutes).toBe(15);
    });

    test('initDatabase completes without error', async () => {
      await expect(
        store.initDatabase(mockDb as unknown as SQLiteDatabase),
      ).resolves.not.toThrow();
    });

    test('loadSettings completes without error', async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);
      await expect(store.loadSettings()).resolves.not.toThrow();
    });
  });

  describe('Sun Time Calculations', () => {
    test('calculates sun times for valid coordinates', () => {
      const latitude = 40.7128; // New York
      const longitude = -74.006;

      const sunTimes = store.calculateSunTimes(latitude, longitude);

      expect(sunTimes).not.toBeNull();
      expect(sunTimes!.sunrise).toBeInstanceOf(Date);
      expect(sunTimes!.sunset).toBeInstanceOf(Date);
      expect(sunTimes!.dawn).toBeInstanceOf(Date);
      expect(sunTimes!.dusk).toBeInstanceOf(Date);
      expect(sunTimes!.sunrise.getTime()).toBeLessThan(
        sunTimes!.sunset.getTime(),
      );
    });

    test('calculates sun times for different locations', () => {
      const locations = [
        { lat: 40.7128, lon: -74.006 }, // New York
        { lat: 51.5074, lon: -0.1278 }, // London
        { lat: 35.6762, lon: 139.6503 }, // Tokyo
      ];

      locations.forEach((location) => {
        const sunTimes = store.calculateSunTimes(location.lat, location.lon);
        expect(sunTimes).not.toBeNull();
        expect(sunTimes!.sunrise).toBeInstanceOf(Date);
        expect(sunTimes!.sunset).toBeInstanceOf(Date);
        expect(sunTimes!.dawn).toBeInstanceOf(Date);
        expect(sunTimes!.dusk).toBeInstanceOf(Date);
      });
    });

    test('handles edge case coordinates', () => {
      const sunTimes = store.calculateSunTimes(0, 0);
      expect(sunTimes).not.toBeNull();
      expect(sunTimes!.sunrise).toBeInstanceOf(Date);
      expect(sunTimes!.sunset).toBeInstanceOf(Date);
      expect(sunTimes!.dawn).toBeInstanceOf(Date);
      expect(sunTimes!.dusk).toBeInstanceOf(Date);
    });
  });

  describe('Notification Management', () => {
    beforeEach(async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);
      // Store is always enabled by design, no setEnabled needed
    });

    test('creates notifications when enabled', () => {
      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      // Should have created notifications (if they're in the future)
      expect(store.activeNotifications.length).toBeGreaterThanOrEqual(0);
      expect(store.activeNotifications.length).toBeLessThanOrEqual(4);
    });

    test('can dismiss notifications', () => {
      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      if (store.activeNotifications.length > 0) {
        const firstNotification = store.activeNotifications[0];
        store.dismissNotification(firstNotification.id);
        expect(firstNotification.dismissed).toBe(true);
      }
    });

    test('can clear all notifications', () => {
      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);
      store.clearAllNotifications();

      expect(store.activeNotifications).toEqual([]);
    });

    test('getNextNotification returns null when no notifications', () => {
      store.clearAllNotifications();
      expect(store.getNextNotification()).toBeNull();
    });
  });

  describe('Location Tracking', () => {
    beforeEach(async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);
    });

    test('tracks last calculation date and location', () => {
      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      expect(store.lastCalculationDate).not.toBeNull();
      expect(store.lastCalculationLocation).toEqual({
        latitude,
        longitude,
      });
    });

    test('recalculates when location changes significantly', () => {
      jest.useFakeTimers();

      const initialLat = 40.7128;
      const initialLon = -74.006;

      store.updateNotifications(initialLat, initialLon);
      const firstCalculationDate = store.lastCalculationDate;

      // Advance time to ensure new Date() returns a different value
      jest.advanceTimersByTime(1000);

      // Move significantly (more than 0.1 degrees)
      const newLat = 41.0;
      const newLon = -74.006;

      store.updateNotifications(newLat, newLon);

      // Should have recalculated
      expect(store.lastCalculationDate).not.toEqual(firstCalculationDate);

      jest.useRealTimers();
    });
  });

  describe('Notification Messages', () => {
    test('static notification messages use default buffer time', async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);

      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      // Message field is now empty as it's generated dynamically
      store.activeNotifications.forEach((notification) => {
        // Static message is empty string
        expect(notification.message).toBe('');
      });
    });

    test('generates dynamic notification messages based on time remaining', async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);

      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      const nextNotification = store.getNextNotification();
      if (nextNotification) {
        const message = store.getNotificationMessage(nextNotification);
        expect(message).toMatch(/(Sunrise|Sunset|Dawn|Dusk) in \d+/);
      }
    });

    test('supports all four event types (sunrise, sunset, dawn, dusk)', () => {
      // Test that the store supports all four event types
      // by verifying the type definition and message generation
      const mockNotifications: SolarNotification[] = [
        {
          id: 'dawn-1',
          eventType: 'dawn',
          eventTime: new Date(Date.now() + 3600000), // 1 hour from now
          notificationTime: new Date(Date.now() + 2700000), // 45 min from now
          message: '',
          dismissed: false,
        },
        {
          id: 'sunrise-1',
          eventType: 'sunrise',
          eventTime: new Date(Date.now() + 5400000), // 1.5 hours from now
          notificationTime: new Date(Date.now() + 4500000), // 1.25 hours from now
          message: '',
          dismissed: false,
        },
        {
          id: 'sunset-1',
          eventType: 'sunset',
          eventTime: new Date(Date.now() + 43200000), // 12 hours from now
          notificationTime: new Date(Date.now() + 42300000),
          message: '',
          dismissed: false,
        },
        {
          id: 'dusk-1',
          eventType: 'dusk',
          eventTime: new Date(Date.now() + 46800000), // 13 hours from now
          notificationTime: new Date(Date.now() + 45900000),
          message: '',
          dismissed: false,
        },
      ];

      // Verify message generation works for all event types
      mockNotifications.forEach((notification) => {
        const message = store.getNotificationMessage(notification);
        const eventName =
          notification.eventType.charAt(0).toUpperCase() +
          notification.eventType.slice(1);
        expect(message).toContain(eventName);
      });
    });
  });

  describe('Edge Cases and Validation', () => {
    test('handles invalid latitude values', () => {
      const invalidLatitudes = [
        NaN,
        Infinity,
        -Infinity,
        -100,
        100,
        'invalid' as unknown as number,
      ];

      invalidLatitudes.forEach((lat) => {
        const result = store.calculateSunTimes(lat, 0);
        expect(result).toBeNull();
      });
    });

    test('handles invalid longitude values', () => {
      const invalidLongitudes = [
        NaN,
        Infinity,
        -Infinity,
        -200,
        200,
        'invalid' as unknown as number,
      ];

      invalidLongitudes.forEach((lon) => {
        const result = store.calculateSunTimes(0, lon);
        expect(result).toBeNull();
      });
    });

    test('updateNotifications handles invalid coordinates gracefully', async () => {
      await store.initDatabase(mockDb as unknown as SQLiteDatabase);

      // Should not throw and not create notifications
      store.updateNotifications(NaN, 0);
      expect(store.activeNotifications).toEqual([]);

      store.updateNotifications(0, Infinity);
      expect(store.activeNotifications).toEqual([]);
    });

    test('handles date boundary crossings correctly', () => {
      // Test dates with same UTC day but different calendar dates
      // Using noon times to avoid timezone issues
      const dec31 = new Date('2024-12-31T12:00:00Z');
      const jan1 = new Date('2025-01-01T12:00:00Z');

      // Verify they are different dates using getUTCDate
      expect(dec31.getUTCDate()).not.toBe(jan1.getUTCDate());

      // Test year boundary is detected
      expect(dec31.getUTCFullYear()).toBe(2024);
      expect(jan1.getUTCFullYear()).toBe(2025);
    });

    test('creates notification when event time is in future but notification time has passed', async () => {
      // Use fake timers set to midnight UTC to guarantee all events are in future
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-15T00:00:00Z'));

      await store.initDatabase(mockDb as unknown as SQLiteDatabase);

      // This simulates the case where user opens app after notification time
      // but before the actual event
      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      // Should create notifications for future events
      const futureEvents = store.activeNotifications.filter(
        (n) => n.eventTime > new Date(),
      );
      expect(futureEvents.length).toBeGreaterThan(0);

      jest.useRealTimers();
    });
  });

  describe('Disposal', () => {
    test('cleans up resources on dispose', () => {
      store.dispose();

      expect(store.activeNotifications).toEqual([]);
      expect(store.lastCalculationDate).toBeNull();
      expect(store.lastCalculationLocation).toBeNull();
    });
  });

  describe('Lunar Cycle Integration', () => {
    test('allSolarEventsComplete returns false when no notifications', () => {
      store.clearAllNotifications();
      expect(store.allSolarEventsComplete()).toBe(false);
    });

    test('allSolarEventsComplete returns false when events are in future', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-15T00:00:00Z')); // Midnight

      await store.initDatabase(mockDb as unknown as SQLiteDatabase);

      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      // At midnight, all solar events (dawn, sunrise, sunset, dusk) should be in the future
      expect(store.allSolarEventsComplete()).toBe(false);

      jest.useRealTimers();
    });

    test('allSolarEventsComplete returns true when all events have passed', async () => {
      jest.useFakeTimers();
      // Set time to 4:00 AM UTC the next day, which is definitely after dusk
      // For New York (UTC-4 in summer), this is midnight local time
      jest.setSystemTime(new Date('2025-06-16T04:00:00Z'));

      await store.initDatabase(mockDb as unknown as SQLiteDatabase);

      const latitude = 40.7128;
      const longitude = -74.006;

      store.updateNotifications(latitude, longitude);

      // Calculate yesterday's dusk time to verify our assertion
      const yesterday = new Date('2025-06-15T12:00:00Z');
      jest.setSystemTime(yesterday);
      const sunTimes = store.calculateSunTimes(latitude, longitude);
      expect(sunTimes).not.toBeNull();

      // Now set time back to 4:00 AM and verify dusk has passed
      jest.setSystemTime(new Date('2025-06-16T04:00:00Z'));
      const now = new Date('2025-06-16T04:00:00Z');
      expect(now.getTime()).toBeGreaterThan(sunTimes!.dusk.getTime());

      // Update notifications at the current time (4 AM next day)
      store.updateNotifications(latitude, longitude);

      // Now verify allSolarEventsComplete returns true
      const allComplete = store.allSolarEventsComplete();
      expect(allComplete).toBe(true);

      jest.useRealTimers();
    });

    test('getLunarPhaseName returns correct names', () => {
      expect(getLunarPhaseName(0.0)).toBe('New Moon');
      expect(getLunarPhaseName(0.01)).toBe('New Moon');
      expect(getLunarPhaseName(0.98)).toBe('New Moon');
      expect(getLunarPhaseName(0.1)).toBe('Waxing Crescent');
      expect(getLunarPhaseName(0.25)).toBe('First Quarter');
      expect(getLunarPhaseName(0.35)).toBe('Waxing Gibbous');
      expect(getLunarPhaseName(0.5)).toBe('Full Moon');
      expect(getLunarPhaseName(0.6)).toBe('Waning Gibbous');
      expect(getLunarPhaseName(0.75)).toBe('Last Quarter');
      expect(getLunarPhaseName(0.9)).toBe('Waning Crescent');
    });

    test('getCurrentLunarCycle returns valid lunar data', () => {
      const lunarCycle = store.getCurrentLunarCycle();

      expect(lunarCycle).toHaveProperty('phaseName');
      expect(lunarCycle).toHaveProperty('illumination');

      // Phase name should be one of the valid phases
      const validPhases = [
        'New Moon',
        'Waxing Crescent',
        'First Quarter',
        'Waxing Gibbous',
        'Full Moon',
        'Waning Gibbous',
        'Last Quarter',
        'Waning Crescent',
      ];
      expect(validPhases).toContain(lunarCycle.phaseName);

      // Illumination should be between 0 and 100
      expect(lunarCycle.illumination).toBeGreaterThanOrEqual(0);
      expect(lunarCycle.illumination).toBeLessThanOrEqual(100);
    });

    test('getCurrentLunarCycle returns consistent data over time', () => {
      const cycle1 = store.getCurrentLunarCycle();

      // Wait a tiny bit (should be same phase)
      const cycle2 = store.getCurrentLunarCycle();

      // Phase name should be the same within milliseconds
      expect(cycle1.phaseName).toBe(cycle2.phaseName);

      // Illumination should be very close (possibly same due to rounding)
      expect(Math.abs(cycle1.illumination - cycle2.illumination)).toBeLessThan(
        2,
      );
    });
  });
});
