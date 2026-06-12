import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import { makeAutoObservable, runInAction } from 'mobx';
import { AppState, NativeEventSubscription } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import Sound from 'react-native-sound';
import Torch from 'react-native-torch';
import { FlashlightModes } from '../../constants';
import { FlashlightModeType } from '../types/common-types';

export class CoreStore {
  private appStateSubscription: NativeEventSubscription;
  private dotSound: Sound | null = null;
  private dashSound: Sound | null = null;
  private audioLoaded: boolean = false;
  private audioLoading: boolean = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    // Keep torch consistent when app state changes (best-effort)
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
    // SOS audio files are loaded lazily on first SOS activation to avoid
    // activating the iOS audio session (and interrupting background audio)
    // at app startup.
  }

  /**
   * Ensures the SOS audio session category is claimed and sound files are
   * loaded. Idempotent — safe to call multiple times; the load is only
   * triggered once (`audioLoading` guards against concurrent calls).
   * @private
   */
  private ensureAudioReady() {
    if (this.audioLoaded || this.audioLoading) return;
    this.audioLoading = true;
    Sound.setCategory('Playback');
    this.loadSosAudio();
  }

  /**
   * Loads the SOS audio files (dot and dash beeps).
   * Releases any previously allocated Sound instances before creating new
   * ones to avoid leaking native resources on repeated calls.
   * @private
   */
  private loadSosAudio() {
    // Release any previously allocated sounds before loading fresh instances.
    if (this.dotSound) {
      this.dotSound.release();
      this.dotSound = null;
    }
    if (this.dashSound) {
      this.dashSound.release();
      this.dashSound = null;
    }

    let dotLoaded = false;
    let dashLoaded = false;
    let hasError = false;

    const checkBothLoaded = () => {
      if (hasError) return;
      if (dotLoaded && dashLoaded) {
        this.audioLoaded = true;
        this.audioLoading = false;
      }
    };

    this.dotSound = new Sound('sos_dot.wav', Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        console.error('Failed to load dot sound:', error);
        hasError = true;
        this.audioLoading = false;
        return;
      }
      dotLoaded = true;
      checkBothLoaded();
    });

    this.dashSound = new Sound('sos_dash.wav', Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        console.error('Failed to load dash sound:', error);
        hasError = true;
        this.audioLoading = false;
        return;
      }
      dashLoaded = true;
      checkBothLoaded();
    });
  }

  // --------------------------------------------------------------------
  // ===== Flashlight =====
  // --------------------------------------------------------------------
  // Flashlight state management
  flashlightMode: FlashlightModeType[keyof FlashlightModeType] =
    FlashlightModes.OFF;
  private sosTimer: ReturnType<typeof setTimeout> | null = null;
  private isTorchOn: boolean = false;
  private strobeInterval: ReturnType<typeof setInterval> | null = null;
  strobeFrequencyHz: number = 5; // default frequency
  nightvisionBrightness: number = 1.0; // brightness level for nightvision (fixed at 100%)
  sosWithTone: boolean = true; // whether SOS should play an accompanying tone (DEFAULT true)

  /**
   * Sets the flashlight mode to the specified value.
   * If the selected mode is already active, toggles the flashlight off.
   * Otherwise, activates the selected mode.
   *
   * @param mode - The desired flashlight mode. Can be 'off', 'on', 'sos', 'strobe', or 'nightvision'.
   */
  setFlashlightMode(mode: FlashlightModeType[keyof FlashlightModeType]) {
    // Exclusive selection: tapping active mode turns it off
    const next = this.flashlightMode === mode ? FlashlightModes.OFF : mode;
    this.flashlightMode = next;
    this.applyFlashlightState();
  }

  get isFlashlightOn() {
    return this.flashlightMode === FlashlightModes.ON;
  }

  /**
   * Applies the current flashlight state based on the `flashlightMode` property.
   * Stops any running SOS or strobe patterns before setting the new state.
   *
   * - If `flashlightMode` is `'on'`, turns the torch on.
   * - If `flashlightMode` is `'sos'`, starts the SOS pattern.
   * - If `flashlightMode` is `'strobe'`, starts the strobe pattern.
   * - If `flashlightMode` is `'nightvision'`, torch is turned off (nightvision uses screen only).
   * - For any other value, turns the torch off.
   *
   * @private
   */
  private applyFlashlightState() {
    // Stop any running patterns
    this.stopSOS();
    this.stopStrobe();
    this.stopMorseTransmission();
    // Apply steady on/off
    if (this.flashlightMode === FlashlightModes.ON) {
      this.setTorch(true);
      return;
    }
    if (this.flashlightMode === FlashlightModes.SOS) {
      this.startSOS();
      return;
    }
    if (this.flashlightMode === FlashlightModes.STROBE) {
      this.startStrobe();
      return;
    }
    if (this.flashlightMode === FlashlightModes.NIGHTVISION) {
      // Nightvision mode uses screen only, torch is off
      this.setTorch(false);
      return;
    }
    // Default: off
    this.setTorch(false);
  }

  /**
   * Handles changes in the application's state.
   *
   * If the app returns to the foreground (`state` is `'active'`),
   * this method re-applies the flashlight state to ensure it is set correctly.
   *
   * @param state - The new state of the application (e.g., `'active'`, `'background'`, etc.).
   */
  private handleAppStateChange = (state: string) => {
    // If returning to foreground while flashlight should be on, re-apply.
    if (state === 'active') {
      this.applyFlashlightState();
    }
  };

  // Low-level torch setter with state tracking
  private setTorch(on: boolean) {
    this.isTorchOn = on;
    Torch.switchState(on);
  }

  // SOS pattern: "... --- ..." in Morse
  // Timing conventions: dot=1 unit, dash=3 units, intra-signal gap=1 unit off,
  // letter gap=3 units off, repetition gap=1000ms off (as requested).
  // Choose unit=200ms for readable pacing.
  private readonly sosUnitMs = 200;

  /**
   * Starts the SOS flashlight signal pattern.
   *
   * This method initiates a repeating sequence that flashes the torch in the Morse code pattern for "SOS":
   * three short flashes (dots), three long flashes (dashes), and three short flashes (dots), with appropriate
   * timing gaps between signals and letters. The sequence repeats with a pause between cycles.
   *
   * If sosWithTone is enabled, audible beep tones accompany the light flashes.
   *
   * If the flashlight mode is changed from 'sos', the sequence stops and the torch is turned off.
   * Any existing SOS pattern is stopped before starting a new one.
   *
   * @private
   */
  private startSOS() {
    this.stopSOS(); // Stop any existing SOS pattern
    // Kick off lazy audio loading when tone is enabled so sounds are ready
    // as soon as possible for the first flash step.
    if (this.sosWithTone) {
      this.ensureAudioReady();
    }
    // Sequence builder: returns array of {on:boolean, ms:number, type:'dot'|'dash'|null}
    const unit = this.sosUnitMs;
    const dot = [
      { on: true, ms: unit, type: 'dot' as const },
      { on: false, ms: unit, type: null },
    ];
    const dash = [
      { on: true, ms: 3 * unit, type: 'dash' as const },
      { on: false, ms: unit, type: null },
    ];
    const letterGap = [{ on: false, ms: 3 * unit, type: null }];

    const S = [...dot, ...dot, ...dot, ...letterGap];
    const O = [...dash, ...dash, ...dash, ...letterGap];
    const sequence = [...S, ...O, ...S];

    const repeatPause = [{ on: false, ms: 1000, type: null }];

    const runOnce = (index: number) => {
      if (this.flashlightMode !== 'sos') {
        this.setTorch(false);
        return;
      }
      const step = sequence[index] ?? null;
      const nextDelay = step ? step.ms : repeatPause[0].ms;
      const nextOn = step ? step.on : false;
      this.setTorch(nextOn);

      // Play audio tone if sosWithTone is enabled and torch is on
      if (this.sosWithTone && nextOn && step) {
        this.playSosTone(step.type);
      }

      const nextIndex = step
        ? index + 1 < sequence.length
          ? index + 1
          : -1
        : -1;
      this.sosTimer = setTimeout(() => {
        if (nextIndex === -1) {
          // Pause then restart sequence
          this.setTorch(false);
          // Clear current timer before creating a new one
          this.sosTimer = null;
          this.sosTimer = setTimeout(() => runOnce(0), repeatPause[0].ms);
        } else {
          runOnce(nextIndex);
        }
      }, nextDelay);
    };

    // Kick off the sequence
    runOnce(0);
  }

  /**
   * Plays an SOS tone (dot or dash beep).
   * @param type - The type of tone to play ('dot' or 'dash')
   * @private
   */
  private playSosTone(type: 'dot' | 'dash' | null) {
    if (!type) return;
    // Trigger audio loading if it hasn't started yet (e.g. when called from
    // Morse transmission before SOS mode has ever been activated).
    this.ensureAudioReady();
    if (!this.audioLoaded) return;

    const sound = type === 'dot' ? this.dotSound : this.dashSound;
    if (sound) {
      try {
        sound.stop(() => {
          sound.play((success) => {
            if (!success) {
              console.error('Failed to play SOS tone');
            }
          });
        });
      } catch (error) {
        console.error('Error playing SOS tone:', error);
      }
    }
  }

  /**
   * Stops the SOS timer if it is currently active.
   * Clears the timeout, resets the `sosTimer` property to `null`, and stops any playing audio.
   *
   * @private
   */
  private stopSOS() {
    if (this.sosTimer) {
      clearTimeout(this.sosTimer);
      this.sosTimer = null;
    }
    // Stop any playing audio
    if (this.dotSound) {
      this.dotSound.stop();
    }
    if (this.dashSound) {
      this.dashSound.stop();
    }
  }

  // Strobe implementation: toggle torch at `strobeFrequencyHz`
  setStrobeFrequency(hz: number) {
    const clamped = Math.max(1, Math.min(15, Math.round(hz)));
    this.strobeFrequencyHz = clamped;
    if (this.flashlightMode === 'strobe') {
      // restart strobe at new frequency
      this.startStrobe();
    }
  }

  /**
   * Starts the strobe effect for the torch by toggling its state at a frequency defined by `strobeFrequencyHz`.
   * The strobe interval is calculated to ensure a minimum period of 10ms.
   * If the flashlight mode changes from 'strobe', the strobe effect is stopped automatically.
   * The torch is set to its initial state immediately before starting the interval.
   *
   * @private
   */
  private startStrobe() {
    this.stopStrobe();
    const hz = this.strobeFrequencyHz;
    const periodMs = Math.max(10, Math.floor(1000 / hz / 2));
    let on = false;
    this.setTorch(on); // Set initial state immediately
    this.strobeInterval = setInterval(() => {
      if (this.flashlightMode !== FlashlightModes.STROBE) {
        this.stopStrobe();
        return;
      }
      on = !on;
      this.setTorch(on);
    }, periodMs);
  }

  /**
   * Stops the strobe effect by clearing the strobe interval and resetting its reference.
   * Ensures the torch is turned off unless the flashlight mode is set to steady on.
   */
  private stopStrobe() {
    if (this.strobeInterval) {
      clearInterval(this.strobeInterval);
      this.strobeInterval = null;
    }
    // Ensure torch off when stopping strobe unless steady on is selected
    if (this.flashlightMode !== FlashlightModes.ON) {
      this.setTorch(false);
    }
  }

  // SOS tone toggle
  /**
   * Toggles the SOS tone on or off.
   *
   * @param enabled - Whether the SOS tone should be enabled.
   */
  setSosWithTone(enabled: boolean) {
    this.sosWithTone = enabled;
    // If SOS is currently active and tone is being switched on, start loading
    // audio immediately so tones are available as soon as possible.
    if (enabled && this.flashlightMode === FlashlightModes.SOS) {
      this.ensureAudioReady();
    }
  }

  // --------------------------------------------------------------------
  // ===== Decibel Meter =====
  // --------------------------------------------------------------------
  decibelMeterActive: boolean = false;
  currentDecibelLevel: number = 0; // Current decibel level (0-100 normalized scale)

  /**
   * Sets the decibel meter active state.
   * When active, the decibel meter appears in the footer.
   *
   * @param active - Whether the decibel meter should be active.
   */
  setDecibelMeterActive(active: boolean) {
    this.decibelMeterActive = active;
    if (!active) {
      // Reset level when deactivated
      this.currentDecibelLevel = 0;
    }
  }

  /**
   * Updates the current decibel level.
   *
   * @param level - The decibel level (0-100 normalized scale).
   */
  setCurrentDecibelLevel(level: number) {
    this.currentDecibelLevel = Math.max(0, Math.min(100, level));
  }

  // --------------------------------------------------------------------
  // ===== Morse Code Transmission =====
  // --------------------------------------------------------------------
  private morseTimer: ReturnType<typeof setTimeout> | null = null;
  isMorseTransmitting: boolean = false;

  /**
   * Transmits a morse code message using the flashlight and optional sound.
   * Uses the same timing conventions as SOS: dot=1 unit, dash=3 units.
   *
   * @param morseCode - The morse code string (e.g., "... --- ...")
   * @param withTone - Whether to play accompanying audio tones
   */
  transmitMorseMessage(morseCode: string, withTone: boolean) {
    // Stop any other flashlight patterns
    this.stopSOS();
    this.stopStrobe();
    this.stopMorseTransmission();
    runInAction(() => {
      this.isMorseTransmitting = true;
    });

    // Start loading audio early so sounds are ready by the first tone step.
    if (withTone) {
      this.ensureAudioReady();
    }

    const unit = this.sosUnitMs;
    const sequence: Array<{
      on: boolean;
      ms: number;
      type: 'dot' | 'dash' | null;
    }> = [];

    // Parse morse code string into sequence
    const chars = morseCode.split('');
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const prevChar = i > 0 ? chars[i - 1] : null;
      const nextChar = i < chars.length - 1 ? chars[i + 1] : null;

      if (char === '.') {
        // Dot: on for 1 unit
        sequence.push({ on: true, ms: unit, type: 'dot' });
        sequence.push({ on: false, ms: unit, type: null }); // intra-signal gap
      } else if (char === '-') {
        // Dash: on for 3 units
        sequence.push({ on: true, ms: 3 * unit, type: 'dash' });
        sequence.push({ on: false, ms: unit, type: null }); // intra-signal gap
      } else if (char === ' ') {
        // Skip spaces that are adjacent to '/' to avoid double-counting gaps
        if (prevChar !== '/' && nextChar !== '/') {
          // Space between letters (already has 1 unit gap from last signal)
          // Add 2 more units to make total 3 units
          sequence.push({ on: false, ms: 2 * unit, type: null });
        }
      } else if (char === '/') {
        // Word separator: 7 units total (already has 1 unit gap from last signal)
        // Add 6 more units to make total 7 units
        sequence.push({ on: false, ms: 6 * unit, type: null });
      }
    }

    const runSequence = (index: number) => {
      if (index >= sequence.length) {
        // Sequence complete
        this.setTorch(false);
        runInAction(() => {
          this.isMorseTransmitting = false;
        });
        return;
      }

      const step = sequence[index];
      this.setTorch(step.on);

      // Play audio tone if enabled and torch is on
      if (withTone && step.on && step.type) {
        this.playSosTone(step.type);
      }

      this.morseTimer = setTimeout(() => {
        runSequence(index + 1);
      }, step.ms);
    };

    // Start the sequence
    runSequence(0);
  }

  /**
   * Stops the current morse code transmission.
   */
  stopMorseTransmission() {
    if (this.morseTimer) {
      clearTimeout(this.morseTimer);
      this.morseTimer = null;
    }
    runInAction(() => {
      this.isMorseTransmitting = false;
    });
    this.setTorch(false);
    // Stop any playing audio
    if (this.dotSound) {
      this.dotSound.stop();
    }
    if (this.dashSound) {
      this.dashSound.stop();
    }
  }

  // --------------------------------------------------------------------
  // ===== Device Status =====
  // --------------------------------------------------------------------
  // Battery state
  batteryLevel: number | null = null;
  isCharging: boolean | null = null;
  batteryEstimateMinutes: number | null = null;
  private lastBatterySample: { level: number; at: number } | null = null;
  private batteryQuickIv: ReturnType<typeof setInterval> | null = null;
  private batterySlowIv: ReturnType<typeof setInterval> | null = null;
  private batteryQuickDeadline: number | null = null;

  // Storage state
  storageTotal: number | null = null;
  storageFree: number | null = null;

  // Connectivity
  netInfo: NetInfoState | null = null;
  private netUnsub: NetInfoSubscription | null = null;

  // GPS
  lastFix: GeoPosition | null = null;
  locationError: string | null = null;
  private gpsIv: ReturnType<typeof setInterval> | null = null;

  /**
   * Sets a fallback battery estimate for charging devices.
   * If battery is at or near 100%, shows maximum runtime (8 hours).
   * Otherwise, shows estimated time to reach 100% (2 hours baseline).
   *
   * @private
   * @param level - Current battery level (0-1)
   */
  private setChargingFallbackEstimate(level: number): void {
    if (level >= 0.99) {
      // Battery is full or nearly full while charging
      // Show maximum runtime estimate (8 hours at 100%)
      this.batteryEstimateMinutes = 480;
    } else {
      // Baseline: 2 hours to charge from current level to 100%
      this.batteryEstimateMinutes = Math.round((1.0 - level) * 120);
    }
  }

  /**
   * Samples the current battery level and charging state using DeviceInfo.
   * Updates the store's battery level and charging status.
   * Provides instant fallback estimates on first sample for both charging and discharging.
   * If a previous battery sample exists, calculates more accurate estimates based on battery drain/charge rate.
   * Handles errors silently.
   *
   * @private
   * @returns {Promise<void>} Resolves when the sampling is complete.
   */
  private sampleBattery = async (): Promise<void> => {
    try {
      const level = await DeviceInfo.getBatteryLevel();
      const power = await DeviceInfo.getPowerState();
      const charging =
        power.batteryState === 'charging' ||
        power.batteryState === 'full' ||
        power.charging === true;
      runInAction(() => {
        this.batteryLevel = level;
        this.isCharging = charging;
      });

      if (this.lastBatterySample) {
        const now = Date.now();
        const dtMin = (now - this.lastBatterySample.at) / 60000;
        const dLevel = this.lastBatterySample.level - level; // positive on drop
        if (dtMin > 0 && dLevel > 0 && !charging) {
          const ratePerMin = dLevel / dtMin;
          if (ratePerMin > 0) {
            const minutesLeft = level / ratePerMin;
            runInAction(() => {
              this.batteryEstimateMinutes = minutesLeft;
            });
          }
        } else if (dtMin > 0 && charging && dLevel < 0) {
          // Device is charging and battery is increasing
          const ratePerMin = Math.abs(dLevel) / dtMin;
          if (ratePerMin > 0) {
            const minutesToFull = (1.0 - level) / ratePerMin;
            runInAction(() => {
              this.batteryEstimateMinutes = minutesToFull;
            });
          }
        } else if (charging) {
          // Charging but no increase yet - provide instant fallback
          runInAction(() => {
            this.setChargingFallbackEstimate(level);
          });
        } else if (dLevel < 0) {
          // Battery increased but not charging - clear estimate
          runInAction(() => {
            this.batteryEstimateMinutes = null;
          });
        }
      } else {
        // First sample - provide instant fallback estimate
        if (charging) {
          runInAction(() => {
            this.setChargingFallbackEstimate(level);
          });
        } else if (level > 0) {
          // Baseline: 8 hours at 100% battery
          runInAction(() => {
            this.batteryEstimateMinutes = Math.round(level * 480);
          });
        }
      }
      runInAction(() => {
        this.lastBatterySample = { level, at: Date.now() };
      });
    } catch {
      // intentionally ignored: battery API may be unavailable on some devices
    }
  };

  /**
   * Starts the battery sampling process.
   *
   * - Immediately samples the battery.
   * - Initiates a quick sampling interval every 15 seconds for approximately 3 minutes.
   * - During quick sampling, checks if a battery estimate is available or if the quick sampling period has expired.
   * - If no estimate is available but battery level is known, sets a fallback estimate (8 hours at 100%).
   * - After quick sampling, clears intervals and switches to slow sampling every 60 seconds.
   *
   * @private
   */
  private startBatterySampling = () => {
    // Immediate sample
    this.sampleBattery();
    // Quick sampling for ~3 minutes
    this.batteryQuickDeadline = Date.now() + 3 * 60 * 1000;
    this.clearBatteryIntervals();
    this.batteryQuickIv = setInterval(() => {
      this.sampleBattery();
      const hasEstimate = this.batteryEstimateMinutes != null;
      const expired =
        this.batteryQuickDeadline != null &&
        Date.now() >= this.batteryQuickDeadline;
      if (hasEstimate || expired) {
        if (!hasEstimate && this.batteryLevel != null && !this.isCharging) {
          // Fallback baseline 8h at 100%
          runInAction(() => {
            this.batteryEstimateMinutes = Math.round(this.batteryLevel! * 480);
          });
        }
        this.clearBatteryIntervals();
        this.batterySlowIv = setInterval(this.sampleBattery, 60000);
      }
    }, 15000);
  };

  /**
   * Clears any active battery-related intervals and resets their references to null.
   *
   * This method checks if the quick and slow battery interval timers are set,
   * clears them if they exist, and then sets their references to null to prevent
   * further unintended usage.
   */
  private clearBatteryIntervals = () => {
    if (this.batteryQuickIv) clearInterval(this.batteryQuickIv);
    if (this.batterySlowIv) clearInterval(this.batterySlowIv);
    this.batteryQuickIv = null;
    this.batterySlowIv = null;
  };

  /**
   * Asynchronously refreshes the device's storage information.
   * Retrieves the total disk capacity and free disk storage using `DeviceInfo`,
   * and updates the `storageTotal` and `storageFree` properties.
   * If retrieval fails, the error is silently ignored.
   *
   * @returns {Promise<void>} Resolves when storage information has been updated.
   */
  private refreshStorage = async (): Promise<void> => {
    try {
      const [total, free] = await Promise.all([
        DeviceInfo.getTotalDiskCapacity(),
        DeviceInfo.getFreeDiskStorage(),
      ]);
      runInAction(() => {
        this.storageTotal = total ?? null;
        this.storageFree = free ?? null;
      });
    } catch {
      // intentionally ignored: disk storage API may be unavailable on some devices
    }
  };

  /**
   * Starts a network information subscription if one is not already active.
   * Uses `NetInfo.addEventListener` to listen for network state changes and updates
   * the `netInfo` property with the latest state.
   * Ensures that only one subscription is active at a time by checking `netUnsub`.
   *
   * @private
   */
  private startNetSubscription = () => {
    if (this.netUnsub) return;
    this.netUnsub = NetInfo.addEventListener((state) => {
      runInAction(() => {
        this.netInfo = state;
      });
    });
  };

  /**
   * Stops the current network subscription by invoking the unsubscribe function if it exists,
   * and resets the subscription reference to null.
   *
   * @private
   */
  private stopNetSubscription = () => {
    if (this.netUnsub) this.netUnsub();
    this.netUnsub = null;
  };

  /**
   * Attempts to retrieve the current GPS position using the Geolocation API.
   *
   * On success, updates `lastFix` with the position and clears any location error.
   * On failure, sets `locationError` with the error message.
   *
   * Uses high accuracy, a timeout of 15 seconds, and allows cached positions up to 5 seconds old.
   */
  private gpsGetFix = () => {
    Geolocation.getCurrentPosition(
      (pos) => {
        runInAction(() => {
          this.lastFix = pos;
          this.locationError = null;
        });
      },
      (err) => {
        runInAction(() => {
          this.locationError = err.message;
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };

  /**
   * Starts polling for GPS location updates.
   *
   * Requests location authorization from the user. If permission is granted,
   * immediately fetches the current GPS fix and sets up a polling interval to
   * repeatedly fetch the GPS fix every 60 seconds. If permission is denied or
   * an error occurs during authorization, sets an appropriate location error message.
   *
   * @private
   * @returns {Promise<void>} Resolves when polling is started or an error is handled.
   */
  private async startGpsPolling(): Promise<void> {
    try {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth === 'granted') {
        this.gpsGetFix();
        if (this.gpsIv) clearInterval(this.gpsIv);
        this.gpsIv = setInterval(() => this.gpsGetFix(), 60000);
      } else {
        runInAction(() => {
          this.locationError = 'Location permission not granted';
        });
      }
    } catch {
      runInAction(() => {
        this.locationError = 'Location permission error';
      });
    }
  }

  /**
   * Stops the GPS polling interval if it is currently active.
   * Clears the interval and resets the interval reference to null.
   *
   * @private
   */
  private stopGpsPolling() {
    if (this.gpsIv) clearInterval(this.gpsIv);
    this.gpsIv = null;
  }

  /**
   * Initiates monitoring of device status by starting battery sampling,
   * refreshing storage information, subscribing to network status updates,
   * and polling GPS data.
   *
   * @remarks
   * This method aggregates multiple device status monitoring routines
   * to provide comprehensive device health and connectivity information.
   */
  startDeviceStatusMonitoring = () => {
    this.startBatterySampling();
    this.refreshStorage();
    this.startNetSubscription();
    this.startGpsPolling();
  };

  /**
   * Stops monitoring the device status by clearing battery intervals,
   * unsubscribing from network status updates, and stopping GPS polling.
   *
   * @remarks
   * This method should be called when device status monitoring is no longer needed,
   * such as during cleanup or when the application is paused.
   */
  stopDeviceStatusMonitoring = () => {
    this.clearBatteryIntervals();
    this.stopNetSubscription();
    this.stopGpsPolling();
  };

  // --------------------------------------------------------------------
  // ==== Cleanup on store disposal ====
  // --------------------------------------------------------------------
  dispose() {
    this.stopSOS();
    this.stopStrobe();
    this.appStateSubscription?.remove();
    this.stopDeviceStatusMonitoring();

    // Release audio resources
    if (this.dotSound) {
      this.dotSound.release();
      this.dotSound = null;
    }
    if (this.dashSound) {
      this.dashSound.release();
      this.dashSound = null;
    }
  }
}
