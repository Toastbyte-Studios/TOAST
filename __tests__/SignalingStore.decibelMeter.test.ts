/**
 * @format
 */

import { SignalingStore } from '../src/stores/SignalingStore';

// Mock react-native-geolocation-service
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
  requestAuthorization: jest.fn(() => Promise.resolve('granted')),
}));

// Mock react-native modules
jest.mock('react-native-torch', () => ({
  switchState: jest.fn(),
}));

jest.mock('react-native-sound', () => {
  const Sound = jest.fn().mockImplementation(() => ({
    play: jest.fn((callback: Function) => callback(true)),
    stop: jest.fn((callback?: Function) => callback && callback()),
    release: jest.fn(),
  })) as jest.Mock & { setCategory: jest.Mock; MAIN_BUNDLE: string };
  Sound.setCategory = jest.fn();
  Sound.MAIN_BUNDLE = '';
  return Sound;
});

jest.mock('react-native-device-info', () => ({
  getBatteryLevel: jest.fn(() => Promise.resolve(0.75)),
  getPowerState: jest.fn(() =>
    Promise.resolve({ batteryState: 'unplugged', charging: false }),
  ),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      type: 'wifi',
    }),
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  NativeModules: {},
  Platform: { OS: 'ios' },
}));

describe('SignalingStore - Decibel Meter', () => {
  let store: SignalingStore;

  beforeEach(() => {
    store = new SignalingStore();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setDecibelMeterActive', () => {
    it('should set decibel meter active state to true', () => {
      expect(store.decibelMeterActive).toBe(false);

      store.setDecibelMeterActive(true);

      expect(store.decibelMeterActive).toBe(true);
    });

    it('should set decibel meter active state to false', () => {
      store.setDecibelMeterActive(true);
      expect(store.decibelMeterActive).toBe(true);

      store.setDecibelMeterActive(false);

      expect(store.decibelMeterActive).toBe(false);
    });

    it('should reset decibel level when deactivated', () => {
      store.setDecibelMeterActive(true);
      store.setCurrentDecibelLevel(75);
      expect(store.currentDecibelLevel).toBe(75);

      store.setDecibelMeterActive(false);

      expect(store.currentDecibelLevel).toBe(0);
    });
  });

  describe('setCurrentDecibelLevel', () => {
    it('should set current decibel level within valid range', () => {
      store.setCurrentDecibelLevel(50);
      expect(store.currentDecibelLevel).toBe(50);
    });

    it('should clamp decibel level to minimum of 0', () => {
      store.setCurrentDecibelLevel(-10);
      expect(store.currentDecibelLevel).toBe(0);
    });

    it('should clamp decibel level to maximum of 100', () => {
      store.setCurrentDecibelLevel(150);
      expect(store.currentDecibelLevel).toBe(100);
    });

    it('should handle boundary values correctly', () => {
      store.setCurrentDecibelLevel(0);
      expect(store.currentDecibelLevel).toBe(0);

      store.setCurrentDecibelLevel(100);
      expect(store.currentDecibelLevel).toBe(100);
    });
  });

  describe('Initial state', () => {
    it('should have decibel meter inactive by default', () => {
      expect(store.decibelMeterActive).toBe(false);
    });

    it('should have decibel level at 0 by default', () => {
      expect(store.currentDecibelLevel).toBe(0);
    });
  });
});
