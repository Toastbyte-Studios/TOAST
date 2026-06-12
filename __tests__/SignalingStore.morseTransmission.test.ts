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
  Platform: {
    OS: 'ios',
  },
}));

describe('SignalingStore - Morse Code Transmission', () => {
  let coreStore: SignalingStore;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    coreStore = new SignalingStore();
  });

  afterEach(() => {
    coreStore.stopMorseTransmission();
    coreStore.dispose();
    jest.useRealTimers();
  });

  describe('transmitMorseMessage', () => {
    it('should set isMorseTransmitting to true when transmission starts', () => {
      expect(coreStore.isMorseTransmitting).toBe(false);
      coreStore.transmitMorseMessage('...', false);
      expect(coreStore.isMorseTransmitting).toBe(true);
    });

    it('should generate sequence and complete transmission', () => {
      coreStore.transmitMorseMessage('.', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      // Run through entire sequence
      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle empty morse code gracefully', () => {
      expect(coreStore.isMorseTransmitting).toBe(false);
      coreStore.transmitMorseMessage('', false);

      // With empty sequence, it should still complete the transmission flow
      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should set isMorseTransmitting to false when transmission completes', () => {
      coreStore.transmitMorseMessage('.', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      // Run through entire sequence
      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle complex morse patterns', () => {
      // SOS pattern: ... --- ...
      coreStore.transmitMorseMessage('... --- ...', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle morse code with spaces between letters', () => {
      coreStore.transmitMorseMessage('. .', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle morse code with word separator', () => {
      coreStore.transmitMorseMessage('. / .', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle morse code with only spaces', () => {
      coreStore.transmitMorseMessage('   ', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle morse code with multiple word separators', () => {
      coreStore.transmitMorseMessage('/ / /', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle transmission with tone enabled', () => {
      coreStore.transmitMorseMessage('.', true);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle transmission with tone disabled', () => {
      coreStore.transmitMorseMessage('.', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });
  });

  describe('stopMorseTransmission', () => {
    it('should set isMorseTransmitting to false', () => {
      coreStore.transmitMorseMessage('...', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      coreStore.stopMorseTransmission();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should clear the morse timer', () => {
      coreStore.transmitMorseMessage('...', false);
      const morseTimer = (
        coreStore as unknown as {
          morseTimer: ReturnType<typeof setTimeout> | null;
        }
      ).morseTimer;
      expect(morseTimer).not.toBeNull();

      coreStore.stopMorseTransmission();
      expect(
        (
          coreStore as unknown as {
            morseTimer: ReturnType<typeof setTimeout> | null;
          }
        ).morseTimer,
      ).toBeNull();
    });

    it('should be safe to call when no transmission is active', () => {
      expect(() => {
        coreStore.stopMorseTransmission();
      }).not.toThrow();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should be safe to call multiple times', () => {
      coreStore.transmitMorseMessage('...', false);
      coreStore.stopMorseTransmission();
      expect(() => {
        coreStore.stopMorseTransmission();
        coreStore.stopMorseTransmission();
      }).not.toThrow();
    });

    it('should stop transmission that is in progress', () => {
      coreStore.transmitMorseMessage('... --- ...', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      // Advance partway through
      jest.advanceTimersByTime(500);
      expect(coreStore.isMorseTransmitting).toBe(true);

      // Stop it
      coreStore.stopMorseTransmission();
      expect(coreStore.isMorseTransmitting).toBe(false);

      // Advancing timers further should not restart
      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });
  });

  describe('Morse transmission integration', () => {
    it('should handle rapid start/stop cycles', () => {
      coreStore.transmitMorseMessage('...', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      coreStore.stopMorseTransmission();
      expect(coreStore.isMorseTransmitting).toBe(false);

      coreStore.transmitMorseMessage('---', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should properly handle message with all morse elements', () => {
      // Test with dots, dashes, letter spaces, and word separators
      coreStore.transmitMorseMessage('.- / -...', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle restarting transmission with different message', () => {
      coreStore.transmitMorseMessage('.', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      // Start a new transmission (should stop the old one first)
      coreStore.transmitMorseMessage('---', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should stop an in-flight transmission during dispose', () => {
      coreStore.transmitMorseMessage('... --- ...', false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.advanceTimersByTime(500);
      coreStore.dispose();

      expect(coreStore.isMorseTransmitting).toBe(false);
      expect((coreStore as any).morseTimer).toBeNull();

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });

    it('should handle long complex messages', () => {
      // Simulate a longer message with mixed content
      const longMessage = '... --- ... / .... . .-.. .--. / -- .';
      coreStore.transmitMorseMessage(longMessage, false);
      expect(coreStore.isMorseTransmitting).toBe(true);

      jest.runAllTimers();
      expect(coreStore.isMorseTransmitting).toBe(false);
    });
  });
});

describe('SignalingStore - SOS audio lazy loading', () => {
  let Sound: jest.Mock & { setCategory: jest.Mock; MAIN_BUNDLE: string };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Sound = require('react-native-sound') as typeof Sound;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should NOT instantiate Sound or call setCategory on construction', () => {
    const store = new SignalingStore();
    expect(Sound).not.toHaveBeenCalled();
    expect(Sound.setCategory).not.toHaveBeenCalled();
    store.dispose();
  });

  it('should instantiate Sound and call setCategory only when SOS is activated with tone enabled', () => {
    const store = new SignalingStore();
    expect(Sound).not.toHaveBeenCalled();

    // Activate SOS mode (sosWithTone defaults to true)
    store.setFlashlightMode('sos');

    expect(Sound.setCategory).toHaveBeenCalledWith('Playback');
    expect(Sound).toHaveBeenCalled(); // sound files loaded
    store.dispose();
  });

  it('should instantiate Sound and call setCategory when morse transmission starts with tone enabled', () => {
    const store = new SignalingStore();
    expect(Sound).not.toHaveBeenCalled();

    store.transmitMorseMessage('... --- ...', true);

    expect(Sound.setCategory).toHaveBeenCalledWith('Playback');
    expect(Sound).toHaveBeenCalled(); // sound files loaded
    store.dispose();
  });

  it('should NOT instantiate Sound when morse transmission starts with tone disabled', () => {
    const store = new SignalingStore();
    expect(Sound).not.toHaveBeenCalled();

    store.transmitMorseMessage('... --- ...', false);

    expect(Sound).not.toHaveBeenCalled();
    expect(Sound.setCategory).not.toHaveBeenCalled();
    store.dispose();
  });

  it('should NOT trigger a second load when ensureAudioReady is called again while loading', () => {
    const store = new SignalingStore();

    // First SOS activation triggers the load
    store.setFlashlightMode('sos');
    const firstCallCount = Sound.mock.calls.length;
    expect(firstCallCount).toBe(2); // dot + dash

    // Second activation while still loading should not trigger another load
    store.setFlashlightMode('off');
    store.setFlashlightMode('sos');
    expect(Sound.mock.calls.length).toBe(2); // still only 2 calls

    store.dispose();
  });

  it('should call ensureAudioReady when setSosWithTone enables tone while SOS is active', () => {
    const store = new SignalingStore();

    // Start SOS with tone disabled so audio is NOT loaded
    store.setSosWithTone(false);
    store.setFlashlightMode('sos');
    expect(Sound).not.toHaveBeenCalled();

    // Now enable tone while SOS is active — should trigger load
    store.setSosWithTone(true);
    expect(Sound.setCategory).toHaveBeenCalledWith('Playback');
    expect(Sound).toHaveBeenCalled();

    store.dispose();
  });
});
