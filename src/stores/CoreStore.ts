import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import { makeAutoObservable, runInAction, computed, comparer } from 'mobx';
import { AppState, NativeEventSubscription } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import Sound from 'react-native-sound';
import Torch from 'react-native-torch';
import { FlashlightModes } from '../../constants';
import { FlashlightModeType } from '../types/common-types';
import { SQLiteDatabase } from '../types/database-types';
import {
  Migration,
  getTableColumns,
  getTableDDL,
  runMigrations,
} from '../utils/dbMigrations';
import { formatTime } from '../utils/timeFormat';

let SQLite: any;
try {
  SQLite = require('react-native-sqlite-storage');
} catch {
  SQLite = null as any;
}

// ─── Notes / categories migrations ───────────────────────────────────────────

const NOTE_MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Create notes table with full current schema',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS notes (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'createdAt INTEGER NOT NULL,' +
          'latitude REAL,' +
          'longitude REAL,' +
          'category TEXT NOT NULL,' +
          "type TEXT NOT NULL CHECK(type IN ('text','sketch','voice'))," +
          'title TEXT,' +
          'text TEXT,' +
          'bookmarked INTEGER DEFAULT 0,' +
          'sketchDataUri TEXT,' +
          'photoUris TEXT,' +
          'audioUri TEXT,' +
          'transcription TEXT,' +
          'duration REAL' +
          ')',
      );
    },
  },
  {
    id: 2,
    description: 'Create categories table',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS categories (' +
          'name TEXT PRIMARY KEY NOT NULL,' +
          'createdAt INTEGER NOT NULL' +
          ')',
      );
    },
  },
  {
    id: 3,
    description:
      'Add missing notes columns for databases created before voice-log support',
    run: async (db) => {
      const columns = await getTableColumns(db, 'notes');
      if (!columns.has('title')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN title TEXT');
      }
      if (!columns.has('bookmarked')) {
        await db.executeSql(
          'ALTER TABLE notes ADD COLUMN bookmarked INTEGER DEFAULT 0',
        );
      }
      if (!columns.has('audioUri')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN audioUri TEXT');
      }
      if (!columns.has('transcription')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN transcription TEXT');
      }
      if (!columns.has('duration')) {
        await db.executeSql('ALTER TABLE notes ADD COLUMN duration REAL');
      }
    },
  },
  {
    id: 4,
    description:
      "Rebuild notes table to add 'voice' to the type CHECK constraint",
    run: async (db) => {
      const ddl = await getTableDDL(db, 'notes');
      // Nothing to do if the table does not exist yet or already has voice support.
      if (!ddl || ddl.includes("'voice'")) return;

      await db.executeSql('ALTER TABLE notes RENAME TO notes_old');
      await db.executeSql(
        'CREATE TABLE notes (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'createdAt INTEGER NOT NULL,' +
          'latitude REAL,' +
          'longitude REAL,' +
          'category TEXT NOT NULL,' +
          "type TEXT NOT NULL CHECK(type IN ('text','sketch','voice'))," +
          'title TEXT,' +
          'text TEXT,' +
          'bookmarked INTEGER DEFAULT 0,' +
          'sketchDataUri TEXT,' +
          'photoUris TEXT,' +
          'audioUri TEXT,' +
          'transcription TEXT,' +
          'duration REAL' +
          ')',
      );
      await db.executeSql(
        'INSERT INTO notes (' +
          'id,createdAt,latitude,longitude,category,type,' +
          'title,text,bookmarked,sketchDataUri,photoUris,' +
          'audioUri,transcription,duration' +
          ') SELECT ' +
          'id,createdAt,latitude,longitude,category,type,' +
          'title,text,bookmarked,sketchDataUri,photoUris,' +
          'audioUri,transcription,duration' +
          ' FROM notes_old',
      );
      await db.executeSql('DROP TABLE notes_old');
    },
  },
];

// ─── Checklists migrations ────────────────────────────────────────────────────

const CHECKLIST_MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Create checklists table',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS checklists (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'name TEXT NOT NULL,' +
          'createdAt INTEGER NOT NULL,' +
          'isDefault INTEGER DEFAULT 0' +
          ')',
      );
    },
  },
  {
    id: 2,
    description: 'Create checklist_items table',
    run: async (db) => {
      await db.executeSql(
        'CREATE TABLE IF NOT EXISTS checklist_items (' +
          'id TEXT PRIMARY KEY NOT NULL,' +
          'checklistId TEXT NOT NULL,' +
          'text TEXT NOT NULL,' +
          'checked INTEGER DEFAULT 0,' +
          '"order" INTEGER NOT NULL,' +
          'FOREIGN KEY(checklistId) REFERENCES checklists(id) ON DELETE CASCADE' +
          ')',
      );
    },
  },
];

export interface Tool {
  id: string;
  name: string;
  icon: string;
}

export type NoteInputType = 'text' | 'sketch' | 'voice';
// NoteCategory is now a string since categories are dynamic
// 'Voice Logs' is still supported for Voice Log feature, but not shown in NotePad
export type NoteCategory = string;

export interface Note {
  id: string;
  createdAt: number; // epoch ms
  latitude?: number;
  longitude?: number;
  category: NoteCategory;
  type: NoteInputType; // text, sketch, or voice
  title?: string;
  text?: string;
  bookmarked?: boolean;
  sketchDataUri?: string; // placeholder for sketch image
  photoUris: string[]; // attached photos (uris)
  audioUri?: string; // for voice logs
  transcription?: string; // for voice logs
  duration?: number; // recording duration in seconds for voice logs
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  text: string;
  checked: boolean;
  order: number; // Maintained for database compatibility; display order determined by alphabetical sorting
}

export interface Checklist {
  id: string;
  name: string;
  createdAt: number;
  isDefault: boolean;
}

export class CoreStore {
  private appStateSubscription: NativeEventSubscription;
  private dotSound: Sound | null = null;
  private dashSound: Sound | null = null;
  private audioLoaded: boolean = false;
  private audioLoading: boolean = false;

  constructor() {
    makeAutoObservable(
      this,
      {
        notesByCategory: computed({ equals: comparer.structural }),
      },
      { autoBind: true },
    );
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
      // ignore
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
      // ignore
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
  // ===== Notepad =====
  // --------------------------------------------------------------------
  notes: Note[] = [];
  // NotePad categories - Voice Logs is separate and managed by Voice Log feature
  // Categories are now dynamic and stored in the database
  categories: string[] = [];
  notesDb: SQLiteDatabase | null = null;

  private generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Creates a new note with optional geolocation data.
   *
   * Attempts to request the user's current location (if permission is granted)
   * and includes latitude and longitude in the note if available. The note is
   * then added to the store and persisted.
   *
   * @param params - The parameters for creating the note.
   * @param params.category - The category of the note (optional, defaults to 'General').
   * @param params.type - The type of input for the note.
   * @param params.title - The title of the note (optional).
   * @param params.text - The text content of the note (optional).
   * @param params.sketchDataUri - The data URI for a sketch associated with the note (optional).
   * @param params.photoUris - An array of URIs for photos attached to the note (optional).
   *
   * @returns A promise that resolves when the note has been created and persisted.
   */
  async createNote(params: {
    category?: NoteCategory;
    type: NoteInputType;
    title?: string;
    text?: string;
    sketchDataUri?: string;
    photoUris?: string[];
  }) {
    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth === 'granted') {
        await new Promise<void>((resolve) => {
          Geolocation.getCurrentPosition(
            (pos) => {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
          );
        });
      }
    } catch {
      // Location unavailable, proceed without it
    }

    const note: Note = {
      id: this.generateId(),
      createdAt: Date.now(),
      ...(latitude !== undefined &&
        longitude !== undefined && { latitude, longitude }),
      category: params.category ?? 'General',
      type: params.type,
      title: params.title,
      text: params.text,
      bookmarked: false,
      sketchDataUri: params.sketchDataUri,
      photoUris: params.photoUris || [],
    };

    runInAction(() => {
      this.notes.unshift(note);
    });
    await this.persistNote(note);
  }

  /**
   * Creates a voice log note with audio recording.
   *
   * Attempts to capture current location and creates a note entry with the provided
   * audio file URI. The note is categorized as "Voice Logs" and includes metadata
   * such as timestamp, location (if available), and audio duration.
   *
   * @param params - The parameters for creating the voice log.
   * @param params.audioUri - The file URI of the recorded audio.
   * @param params.duration - The duration of the recording in seconds.
   * @param params.transcription - Optional transcription text (if available).
   *
   * @returns A promise that resolves when the voice log has been created and persisted.
   */
  async createVoiceLog(params: {
    audioUri: string;
    duration: number;
    transcription?: string;
  }) {
    let latitude: number | undefined;
    let longitude: number | undefined;

    // Try to get current location with a shorter timeout for voice logs
    try {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth === 'granted') {
        await new Promise<void>((resolve) => {
          Geolocation.getCurrentPosition(
            (pos) => {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
          );
        });
      }
    } catch {
      // Location unavailable, proceed without it
    }

    const now = Date.now();
    const timeStr = formatTime(new Date(now));

    const note: Note = {
      id: this.generateId(),
      createdAt: now,
      ...(latitude !== undefined &&
        longitude !== undefined && { latitude, longitude }),
      category: 'Voice Logs',
      type: 'voice',
      title: `Voice Log – ${timeStr}`,
      text: params.transcription ?? 'Audio only',
      bookmarked: false,
      sketchDataUri: undefined,
      photoUris: [],
      audioUri: params.audioUri,
      transcription: params.transcription,
      duration: params.duration,
    };

    runInAction(() => {
      this.notes.unshift(note);
    });
    await this.persistNote(note);
  }

  /**
   * Toggles the bookmarked state of a note with the specified ID.
   *
   * Finds the note in the `notes` array by its `noteId` and toggles its `bookmarked` property.
   * After updating the bookmarked state, it calls `persistNote` to persist the change to the database.
   *
   * @param noteId - The unique identifier of the note to toggle.
   */
  async toggleNoteBookmark(noteId: string) {
    const note = this.notes.find((n) => n.id === noteId);
    if (note) {
      runInAction(() => {
        note.bookmarked = !note.bookmarked;
      });
      await this.persistNote(note);
    }
  }

  /**
   * Updates the content of an existing note.
   *
   * Finds the note by its ID and updates its title, text, and/or category.
   * After updating the note properties, it calls `updateNote` to persist the changes.
   *
   * @param noteId - The unique identifier of the note to update.
   * @param params - The parameters containing the fields to update.
   * @param params.title - The new title for the note (optional).
   * @param params.text - The new text content for the note (optional).
   * @param params.category - The new category for the note (optional).
   */
  async updateNoteContent(
    noteId: string,
    params: {
      title?: string;
      text?: string;
      category?: NoteCategory;
      sketchDataUri?: string;
      photoUris?: string[];
    },
  ) {
    const note = this.notes.find((n) => n.id === noteId);
    if (note) {
      runInAction(() => {
        if (params.title !== undefined) {
          note.title = params.title;
        }
        if (params.text !== undefined) {
          note.text = params.text;
        }
        if (params.category !== undefined) {
          note.category = params.category;
        }
        if (params.sketchDataUri !== undefined) {
          note.sketchDataUri = params.sketchDataUri;
        }
        if (params.photoUris !== undefined) {
          note.photoUris = params.photoUris;
        }
      });
      await this.updateNote(note);
    }
  }

  /**
   * Sets the note category with the specified ID.
   *
   * Finds the note in the `notes` array by its `noteId` and sets its `category` property
   * to the provided `category` value. After updating the category, it calls `updateNote`
   * to persist or propagate the change.
   *
   * @param noteId - The unique identifier of the note to update.
   * @param category - The new category to assign to the note.
   */
  setNoteCategory(noteId: string, category: NoteCategory) {
    const idx = this.notes.findIndex((n) => n.id === noteId);
    if (idx >= 0) {
      runInAction(() => {
        this.notes[idx].category = category;
      });
      this.updateNote(this.notes[idx]);
    }
  }

  /**
   * Attaches a photo URI to the note with the specified ID.
   *
   * Finds the note by its ID, adds the provided photo URI to its `photoUris` array,
   * and updates the note in the store.
   *
   * @param noteId - The unique identifier of the note to which the photo will be attached.
   * @param uri - The URI of the photo to attach to the note.
   */
  attachPhoto(noteId: string, uri: string) {
    const note = this.notes.find((item) => item.id === noteId);
    if (note) {
      runInAction(() => {
        note.photoUris.push(uri);
      });
      this.updateNote(note);
    }
  }

  /**
   * Deletes a note by its ID from both the SQLite database and the in-memory notes list.
   *
   * The method first attempts to remove the note from the SQLite database to ensure data consistency.
   * If the database is not initialized, it removes the note from memory only.
   * After a successful database deletion, it updates the in-memory notes list.
   *
   * If an error occurs during deletion, it logs the error and attempts to reload the notes from the database
   * to recover from a potentially inconsistent state. If reloading also fails, it logs a critical error.
   *
   * @param noteId - The unique identifier of the note to be deleted.
   * @returns A Promise that resolves when the deletion process is complete.
   */
  async deleteNote(noteId: string) {
    // Remove from SQLite first to ensure consistency
    try {
      await this.initNotesDb();
      if (!this.notesDb) {
        // If no database, just remove from memory
        runInAction(() => {
          this.notes = this.notes.filter((n) => n.id !== noteId);
        });
        return;
      }
      await this.notesDb.executeSql('DELETE FROM notes WHERE id = ?', [noteId]);
      // Only remove from in-memory list after successful database deletion
      runInAction(() => {
        this.notes = this.notes.filter((n) => n.id !== noteId);
      });
    } catch (error) {
      console.error('Failed to delete note from database:', noteId, error);
      // Reload notes from database to recover from inconsistent state
      try {
        await this.loadNotes();
        console.log(
          'Successfully reloaded notes from database after delete failure',
        );
      } catch (reloadError) {
        console.error(
          'Failed to reload notes after delete failure - app state may be inconsistent:',
          reloadError,
        );
      }
    }
  }

  /**
   * Returns the first 20 notes from the `notes` array.
   *
   * @remarks
   * This getter provides a quick way to access the most recent notes,
   * assuming the `notes` array is ordered with the most recent notes first.
   *
   * @returns An array containing up to 20 of the most recent `Note` objects.
   */
  get recentNotesTop20(): Note[] {
    return this.notes.slice(0, 20);
  }

  /**
   * Returns all bookmarked notes from the notes array.
   *
   * @remarks
   * This getter provides a quick way to access all notes that have been bookmarked.
   *
   * @returns An array of all bookmarked `Note` objects.
   */
  get bookmarkedNotes(): Note[] {
    return this.notes.filter((n) => n.bookmarked === true);
  }

  /**
   * Groups notes by their category and returns a mapping from each category to an array of notes belonging to that category.
   * Excludes Voice Logs which is managed separately.
   *
   * @returns An object where each key is a category name and the value is an array of notes in that category.
   */
  get notesByCategory(): Record<string, Note[]> {
    const map: Record<string, Note[]> = {};
    // Initialize all categories with empty arrays
    for (const category of this.categories) {
      map[category] = [];
    }
    // Populate with notes (excluding Voice Logs)
    for (const n of this.notes) {
      if (n.category === 'Voice Logs') {
        continue;
      }
      if (map[n.category]) {
        map[n.category].push(n);
      } else {
        const fallbackCategory = 'General';
        // Only assign to the fallback category if it already exists in the initialized categories map.
        if (Object.prototype.hasOwnProperty.call(map, fallbackCategory)) {
          map[fallbackCategory].push(n);
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn(
              `Note with orphaned category "${String(
                n.category,
              )}" assigned to fallback category "${fallbackCategory}".`,
            );
          }
        } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(
            `Note with orphaned category "${String(
              n.category,
            )}" could not be assigned to fallback category "${fallbackCategory}" because it is not in the current categories list.`,
          );
        }
      }
    }
    return map;
  }

  // ===== SQLite persistence =====
  /**
   * Initializes the notes database if it has not already been initialized.
   *
   * - Enables promise-based API for the SQLite plugin if available.
   * - Opens (or creates) a SQLite database named 'toast.db' at the default location.
   * - Creates the 'notes' table if it does not exist, with columns for id, createdAt, latitude, longitude, category, type, text, sketchDataUri, and photoUris.
   * - Handles errors by logging them and setting `notesDb` to null if initialization fails.
   *
   * @async
   * @returns {Promise<void>} Resolves when the database is initialized or already exists.
   */
  async initNotesDb(): Promise<void> {
    if (this.notesDb) return;
    if (!SQLite) return;
    try {
      SQLite.enablePromise?.(true);
      const db = await SQLite.openDatabase({
        name: 'toast.db',
        location: 'default',
      });
      this.notesDb = db;
      await runMigrations(db, 'notes', NOTE_MIGRATIONS);
    } catch (error) {
      console.error('Failed to initialize notes database:', error);
      this.notesDb = null;
    }
  }

  /**
   * Loads notes from the local database, parses their fields, and updates the store's notes array.
   *
   * This method initializes the notes database if it hasn't been already, executes a SQL query to
   * retrieve all notes ordered by their creation date (descending), and processes each row to construct
   * a `Note` object. It handles optional fields and parses the `photoUris` JSON string safely.
   * The resulting array of notes is then set to the store's `notes` property within a MobX action.
   *
   * @async
   * @returns {Promise<void>} Resolves when notes have been loaded and the store updated.
   */
  async loadNotes(): Promise<void> {
    await this.initNotesDb();
    if (!this.notesDb) return;
    const res = await this.notesDb.executeSql(
      'SELECT * FROM notes ORDER BY createdAt DESC',
    );
    const rows = res[0].rows;
    const loaded: Note[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows.item(i);
      loaded.push({
        id: r.id,
        createdAt: r.createdAt,
        latitude: r.latitude ?? undefined,
        longitude: r.longitude ?? undefined,
        category: r.category,
        type: r.type,
        title: r.title ?? undefined,
        text: r.text ?? undefined,
        bookmarked: r.bookmarked === 1 ? true : false,
        sketchDataUri: r.sketchDataUri ?? undefined,
        photoUris: (() => {
          if (!r.photoUris) return [];
          try {
            return JSON.parse(r.photoUris);
          } catch (e) {
            console.warn('Failed to parse photoUris for note:', r.id, e);
            return [];
          }
        })(),
        audioUri: r.audioUri ?? undefined,
        transcription: r.transcription ?? undefined,
        duration: r.duration ?? undefined,
      });
    }
    runInAction(() => {
      this.notes = loaded;
    });
  }

  /**
   * Persists a note object into the local notes database. If a note with the same ID already exists,
   * it will be replaced. Initializes the database if it hasn't been initialized yet.
   *
   * @param note - The note object to be persisted.
   * @throws Will throw an error if the database operation fails.
   */
  async persistNote(note: Note) {
    try {
      await this.initNotesDb();
      if (!this.notesDb) return;
      await this.notesDb.executeSql(
        'INSERT OR REPLACE INTO notes (id, createdAt, latitude, longitude, category, type, title, text, bookmarked, sketchDataUri, photoUris, audioUri, transcription, duration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          note.id,
          note.createdAt,
          note.latitude ?? null,
          note.longitude ?? null,
          note.category,
          note.type,
          note.title ?? null,
          note.text ?? null,
          note.bookmarked ? 1 : 0,
          note.sketchDataUri ?? null,
          JSON.stringify(note.photoUris ?? []),
          note.audioUri ?? null,
          note.transcription ?? null,
          note.duration ?? null,
        ],
      );
    } catch (error) {
      console.error('Failed to persist note:', error);
      throw error;
    }
  }

  /**
   * Updates the given note by persisting its changes.
   *
   * @param note - The note object to be updated and persisted.
   * @returns A promise that resolves when the note has been successfully updated.
   * @throws Will throw an error if persisting the note fails.
   */
  async updateNote(note: Note) {
    try {
      await this.persistNote(note);
    } catch (error) {
      console.error('Failed to update note:', error);
      throw error;
    }
  }

  // ===== Category Management =====
  /**
   * Loads categories from the database.
   * If no categories exist, creates default categories.
   */
  async loadCategories(): Promise<void> {
    await this.initNotesDb();
    if (!this.notesDb) {
      // If no database, use default categories
      runInAction(() => {
        this.categories = ['General', 'Work', 'Personal', 'Ideas'];
      });
      return;
    }
    try {
      const res = await this.notesDb.executeSql(
        'SELECT * FROM categories ORDER BY createdAt ASC',
      );
      const rows = res[0].rows;
      const loadedCategories: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows.item(i);
        loadedCategories.push(r.name);
      }
      runInAction(() => {
        this.categories = loadedCategories;
      });
      // If no categories exist, create defaults
      if (loadedCategories.length === 0) {
        await this.createDefaultCategories();
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Fallback to default categories
      runInAction(() => {
        this.categories = ['General', 'Work', 'Personal', 'Ideas'];
      });
    }
  }

  /**
   * Creates default categories.
   */
  async createDefaultCategories(): Promise<void> {
    const defaultCategories = ['General', 'Work', 'Personal', 'Ideas'];
    for (const category of defaultCategories) {
      try {
        await this.addCategory(category);
      } catch (error: any) {
        // If the category already exists, skip and continue with the remaining defaults.
        if (
          error instanceof Error &&
          error.message === 'Category already exists'
        ) {
          continue;
        }
        // Re-throw unexpected errors to preserve existing failure behavior.
        throw error;
      }
    }
  }

  /**
   * Adds a new category.
   * @param name - The name of the category to add.
   * @throws Will throw an error if the category already exists or if the database operation fails.
   */
  async addCategory(name: string): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Category name cannot be empty');
    }
    if (trimmedName === 'Voice Logs') {
      throw new Error('Voice Logs is a reserved category name');
    }
    if (
      this.categories.some(
        (category) => category.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      throw new Error('Category already exists');
    }
    await this.initNotesDb();
    if (!this.notesDb) {
      // If no database, just add to memory
      runInAction(() => {
        this.categories.push(trimmedName);
      });
      return;
    }
    try {
      await this.notesDb.executeSql(
        'INSERT INTO categories (name, createdAt) VALUES (?, ?)',
        [trimmedName, Date.now()],
      );
      runInAction(() => {
        this.categories.push(trimmedName);
      });
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  }

  /**
   * Deletes a category.
   * If the category has notes, they will be reassigned to the specified fallback category.
   *
   * Note: The note count shown in UI warnings is advisory. Due to the async nature of the operation,
   * the actual number of notes moved may differ if notes are added/modified between the count check
   * and the deletion. The database transaction ensures atomicity of the deletion itself.
   *
   * @param name - The name of the category to delete.
   * @param fallbackCategory - The category to reassign notes to. If not specified, uses the first available category.
   * @throws Will throw an error if trying to delete the last category or if the database operation fails.
   */
  async deleteCategory(name: string, fallbackCategory?: string): Promise<void> {
    if (this.categories.length <= 1) {
      throw new Error('Cannot delete the last category');
    }
    if (!this.categories.includes(name)) {
      throw new Error('Category does not exist');
    }

    // Determine fallback category if not provided
    const actualFallback =
      fallbackCategory || this.categories.find((c) => c !== name);
    if (!actualFallback) {
      throw new Error('No fallback category available');
    }
    if (actualFallback === name) {
      throw new Error(
        'Fallback category cannot be the same as the category being deleted',
      );
    }
    if (!this.categories.includes(actualFallback)) {
      throw new Error('Fallback category does not exist');
    }

    await this.initNotesDb();

    // Reassign notes from the deleted category to the fallback category
    const notesToReassign = this.notes.filter((n) => n.category === name);

    if (!this.notesDb) {
      // No database: update notes and categories only in memory, as before
      for (const note of notesToReassign) {
        runInAction(() => {
          note.category = actualFallback;
        });
        await this.updateNote(note);
      }
      runInAction(() => {
        this.categories = this.categories.filter((c) => c !== name);
      });
      return;
    }

    try {
      // Use a transaction to ensure atomicity of the delete operation
      await this.notesDb.executeSql('BEGIN TRANSACTION');

      try {
        // Database present: batch update all affected notes in a single query
        await this.notesDb.executeSql(
          'UPDATE notes SET category = ? WHERE category = ?',
          [actualFallback, name],
        );

        // Delete the category
        await this.notesDb.executeSql('DELETE FROM categories WHERE name = ?', [
          name,
        ]);

        await this.notesDb.executeSql('COMMIT');

        // Update in-memory state after successful transaction
        runInAction(() => {
          for (const note of notesToReassign) {
            note.category = actualFallback;
          }
          this.categories = this.categories.filter((c) => c !== name);
        });
      } catch (transactionError) {
        // Rollback on any error
        await this.notesDb.executeSql('ROLLBACK');
        throw transactionError;
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      throw error;
    }
  }

  /**
   * Gets the count of notes in a specific category.
   * @param categoryName - The name of the category.
   * @returns The number of notes in the category.
   */
  getCategoryNoteCount(categoryName: string): number {
    return this.notes.filter((n) => n.category === categoryName).length;
  }

  // --------------------------------------------------------------------
  // ===== Checklists =====
  // --------------------------------------------------------------------
  checklists: Checklist[] = [];
  checklistItems: ChecklistItem[] = [];

  /**
   * Initializes the checklists database tables if they don't exist.
   * Creates tables for checklists and checklist_items.
   */
  async initChecklistsDb(): Promise<void> {
    await this.initNotesDb(); // Reuse the same database
    if (!this.notesDb) return;
    try {
      await runMigrations(this.notesDb, 'checklists', CHECKLIST_MIGRATIONS);
    } catch (error) {
      console.error('Failed to initialize checklists database:', error);
    }
  }

  /**
   * Loads checklists and checklist items from the database.
   * If no checklists exist, creates default checklists with default items.
   */
  async loadChecklists(): Promise<void> {
    await this.initChecklistsDb();
    if (!this.notesDb) return;

    try {
      // Load checklists
      const checklistsRes = await this.notesDb.executeSql(
        'SELECT * FROM checklists ORDER BY createdAt ASC',
      );
      const checklistRows = checklistsRes[0].rows;
      const loadedChecklists: Checklist[] = [];
      for (let i = 0; i < checklistRows.length; i++) {
        const r = checklistRows.item(i);
        loadedChecklists.push({
          id: r.id,
          name: r.name,
          createdAt: r.createdAt,
          isDefault: r.isDefault === 1,
        });
      }

      // Load checklist items
      const itemsRes = await this.notesDb.executeSql(
        'SELECT * FROM checklist_items ORDER BY checklistId, "order" ASC',
      );
      const itemRows = itemsRes[0].rows;
      const loadedItems: ChecklistItem[] = [];
      for (let i = 0; i < itemRows.length; i++) {
        const r = itemRows.item(i);
        loadedItems.push({
          id: r.id,
          checklistId: r.checklistId,
          text: r.text,
          checked: r.checked === 1,
          order: r.order,
        });
      }

      runInAction(() => {
        this.checklists = loadedChecklists;
        this.checklistItems = loadedItems;
      });

      // If no checklists exist, create defaults
      if (loadedChecklists.length === 0) {
        await this.createDefaultChecklists();
      }
    } catch (error) {
      console.error('Failed to load checklists:', error);
    }
  }

  /**
   * Creates default checklists with default items.
   */
  async createDefaultChecklists(): Promise<void> {
    const defaultChecklists = [
      {
        name: 'Bug-out bag',
        items: [
          'Can opener',
          'Cell phone with chargers',
          'Dust mask or cloth',
          'Emergency radio',
          'First aid kit',
          'Flashlight and extra batteries',
          'Local maps',
          'Matches in waterproof container',
          'Moist towelettes and garbage bags',
          'Multi-tool or knife',
          'Non-perishable food (3-day supply)',
          'Plastic sheeting and duct tape',
          'Water (1 gallon per person per day)',
          'Whistle to signal for help',
          'Wrench or pliers',
        ],
      },
      {
        name: 'First-aid kit',
        items: [
          'Adhesive bandages (various sizes)',
          'Adhesive tape',
          'Antibiotic ointment',
          'Antiseptic wipes',
          'Cotton balls and swabs',
          'CPR face shield',
          'Disposable gloves',
          'Elastic bandage',
          'Emergency blanket',
          'Gauze pads and rolls',
          'Pain relievers (aspirin, ibuprofen)',
          'Prescription medications',
          'Scissors',
          'Thermometer',
          'Tweezers',
        ],
      },
      {
        name: 'Evacuation kit',
        items: [
          'Baby supplies (if needed)',
          'Books or games',
          'Cash and credit cards',
          'Change of clothes',
          'Copies of insurance policies',
          'Emergency contact list',
          'Eyeglasses/contacts',
          'Important documents (copies)',
          'Medications (7-day supply)',
          'Personal hygiene items',
          'Pet supplies (if needed)',
          'Phone charger and battery pack',
          'Sleeping bag or blanket',
          'Spare keys',
          'Sturdy shoes',
        ],
      },
    ];

    for (const defaultChecklist of defaultChecklists) {
      await this.createChecklist(
        defaultChecklist.name,
        true,
        defaultChecklist.items,
      );
    }
  }

  /**
   * Creates a new checklist with optional default items.
   */
  async createChecklist(
    name: string,
    isDefault: boolean = false,
    defaultItems: string[] = [],
  ): Promise<void> {
    const checklist: Checklist = {
      id: this.generateId(),
      name,
      createdAt: Date.now(),
      isDefault,
    };

    runInAction(() => {
      this.checklists.push(checklist);
    });

    await this.persistChecklist(checklist);

    // Add default items if provided
    for (let i = 0; i < defaultItems.length; i++) {
      await this.addChecklistItem(checklist.id, defaultItems[i]);
    }
  }

  /**
   * Deletes a checklist and all its items.
   */
  async deleteChecklist(checklistId: string): Promise<void> {
    try {
      await this.initChecklistsDb();
      if (!this.notesDb) {
        runInAction(() => {
          this.checklists = this.checklists.filter((c) => c.id !== checklistId);
          this.checklistItems = this.checklistItems.filter(
            (i) => i.checklistId !== checklistId,
          );
        });
        return;
      }

      // Delete checklist items first
      await this.notesDb.executeSql(
        'DELETE FROM checklist_items WHERE checklistId = ?',
        [checklistId],
      );
      // Delete checklist
      await this.notesDb.executeSql('DELETE FROM checklists WHERE id = ?', [
        checklistId,
      ]);

      runInAction(() => {
        this.checklists = this.checklists.filter((c) => c.id !== checklistId);
        this.checklistItems = this.checklistItems.filter(
          (i) => i.checklistId !== checklistId,
        );
      });
    } catch (error) {
      console.error('Failed to delete checklist:', error);
      throw error;
    }
  }

  /**
   * Adds a new item to a checklist.
   * New items are added to the top of the list (order = 0).
   */
  async addChecklistItem(checklistId: string, text: string): Promise<void> {
    const existingItems = this.checklistItems.filter(
      (i) => i.checklistId === checklistId,
    );

    // Determine the next order value (for database storage; display order is alphabetical)
    const maxOrder =
      existingItems.length > 0
        ? Math.max(...existingItems.map((i) => i.order))
        : -1;

    const item: ChecklistItem = {
      id: this.generateId(),
      checklistId,
      text,
      checked: false,
      order: maxOrder + 1,
    };

    runInAction(() => {
      this.checklistItems.push(item);
    });

    // Persist the new item
    await this.persistChecklistItem(item);
  }

  /**
   * Toggles the checked state of a checklist item.
   */
  async toggleChecklistItem(itemId: string): Promise<void> {
    const item = this.checklistItems.find((i) => i.id === itemId);
    if (item) {
      runInAction(() => {
        item.checked = !item.checked;
      });
      await this.persistChecklistItem(item);
    }
  }

  /**
   * Deletes a checklist item.
   */
  async deleteChecklistItem(itemId: string): Promise<void> {
    try {
      await this.initChecklistsDb();
      if (!this.notesDb) {
        runInAction(() => {
          this.checklistItems = this.checklistItems.filter(
            (i) => i.id !== itemId,
          );
        });
        return;
      }

      await this.notesDb.executeSql(
        'DELETE FROM checklist_items WHERE id = ?',
        [itemId],
      );

      runInAction(() => {
        this.checklistItems = this.checklistItems.filter(
          (i) => i.id !== itemId,
        );
      });
    } catch (error) {
      console.error('Failed to delete checklist item:', error);
      throw error;
    }
  }

  /**
   * Persists a checklist to the database.
   */
  async persistChecklist(checklist: Checklist): Promise<void> {
    try {
      await this.initChecklistsDb();
      if (!this.notesDb) return;
      await this.notesDb.executeSql(
        'INSERT OR REPLACE INTO checklists (id, name, createdAt, isDefault) VALUES (?,?,?,?)',
        [
          checklist.id,
          checklist.name,
          checklist.createdAt,
          checklist.isDefault ? 1 : 0,
        ],
      );
    } catch (error) {
      console.error('Failed to persist checklist:', error);
      throw error;
    }
  }

  /**
   * Persists a checklist item to the database.
   */
  async persistChecklistItem(item: ChecklistItem): Promise<void> {
    try {
      await this.initChecklistsDb();
      if (!this.notesDb) return;
      await this.notesDb.executeSql(
        'INSERT OR REPLACE INTO checklist_items (id, checklistId, text, checked, "order") VALUES (?,?,?,?,?)',
        [
          item.id,
          item.checklistId,
          item.text,
          item.checked ? 1 : 0,
          item.order,
        ],
      );
    } catch (error) {
      console.error('Failed to persist checklist item:', error);
      throw error;
    }
  }

  /**
   * Gets all items for a specific checklist.
   */
  getChecklistItems(checklistId: string): ChecklistItem[] {
    return this.checklistItems
      .filter((item) => item.checklistId === checklistId)
      .sort((a, b) =>
        a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }),
      );
  }

  // --------------------------------------------------------------------
  // ==== Backup / Restore ====
  // --------------------------------------------------------------------

  /**
   * Imports notes and note categories from a backup.
   * In 'replace' mode all existing notes and categories are removed first.
   * In 'merge' mode new notes and categories are added without removing existing ones.
   *
   * @param noteCategories - Category names to import.
   * @param notes - Notes to import.
   * @param mode - 'replace' clears all existing data first; 'merge' adds without deleting.
   */
  async importNotesData(
    noteCategories: string[],
    notes: Note[],
    mode: 'replace' | 'merge',
  ): Promise<void> {
    await this.initNotesDb();
    if (this.notesDb) {
      const noteSql =
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO notes (id, createdAt, latitude, longitude, category, type, title, text, bookmarked, sketchDataUri, photoUris, audioUri, transcription, duration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
          : 'INSERT OR IGNORE INTO notes (id, createdAt, latitude, longitude, category, type, title, text, bookmarked, sketchDataUri, photoUris, audioUri, transcription, duration) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
      try {
        await this.notesDb.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.notesDb.executeSql('DELETE FROM notes');
          await this.notesDb.executeSql('DELETE FROM categories');
        }
        for (const cat of noteCategories) {
          await this.notesDb.executeSql(
            'INSERT OR IGNORE INTO categories (name, createdAt) VALUES (?, ?)',
            [cat, Date.now()],
          );
        }
        for (const note of notes) {
          await this.notesDb.executeSql(noteSql, [
            note.id,
            note.createdAt,
            note.latitude ?? null,
            note.longitude ?? null,
            note.category,
            note.type,
            note.title ?? null,
            note.text ?? null,
            note.bookmarked ? 1 : 0,
            note.sketchDataUri ?? null,
            JSON.stringify(note.photoUris ?? []),
            note.audioUri ?? null,
            note.transcription ?? null,
            note.duration ?? null,
          ]);
        }
        await this.notesDb.executeSql('COMMIT');
      } catch (error) {
        await this.notesDb.executeSql('ROLLBACK');
        throw error;
      }
    }
    runInAction(() => {
      if (mode === 'replace') {
        this.categories = noteCategories;
        this.notes = notes;
      } else {
        const newCats = noteCategories.filter(
          (c) => !this.categories.includes(c),
        );
        const existingIds = new Set(this.notes.map((n) => n.id));
        const newNotes = notes.filter((n) => !existingIds.has(n.id));
        this.categories = [...this.categories, ...newCats];
        this.notes = [...this.notes, ...newNotes];
      }
    });
  }

  /**
   * Imports checklists and checklist items from a backup.
   * In 'replace' mode all existing checklists and items are removed first.
   * In 'merge' mode new checklists are added without removing existing ones.
   *
   * @param checklists - Checklists to import.
   * @param checklistItems - Checklist items to import.
   * @param mode - 'replace' clears all existing data first; 'merge' adds without deleting.
   */
  async importChecklistsData(
    checklists: Checklist[],
    checklistItems: ChecklistItem[],
    mode: 'replace' | 'merge',
  ): Promise<void> {
    await this.initChecklistsDb();
    if (this.notesDb) {
      const checklistSql =
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO checklists (id, name, createdAt, isDefault) VALUES (?,?,?,?)'
          : 'INSERT OR IGNORE INTO checklists (id, name, createdAt, isDefault) VALUES (?,?,?,?)';
      const itemSql =
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO checklist_items (id, checklistId, text, checked, "order") VALUES (?,?,?,?,?)'
          : 'INSERT OR IGNORE INTO checklist_items (id, checklistId, text, checked, "order") VALUES (?,?,?,?,?)';
      try {
        await this.notesDb.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.notesDb.executeSql('DELETE FROM checklist_items');
          await this.notesDb.executeSql('DELETE FROM checklists');
        }
        for (const checklist of checklists) {
          await this.notesDb.executeSql(checklistSql, [
            checklist.id,
            checklist.name,
            checklist.createdAt,
            checklist.isDefault ? 1 : 0,
          ]);
        }
        for (const item of checklistItems) {
          await this.notesDb.executeSql(itemSql, [
            item.id,
            item.checklistId,
            item.text,
            item.checked ? 1 : 0,
            item.order,
          ]);
        }
        await this.notesDb.executeSql('COMMIT');
      } catch (error) {
        await this.notesDb.executeSql('ROLLBACK');
        throw error;
      }
    }
    runInAction(() => {
      if (mode === 'replace') {
        this.checklists = checklists;
        this.checklistItems = checklistItems;
      } else {
        const existingChecklistIds = new Set(this.checklists.map((c) => c.id));
        const newChecklists = checklists.filter(
          (c) => !existingChecklistIds.has(c.id),
        );
        const existingItemIds = new Set(this.checklistItems.map((i) => i.id));
        const newItems = checklistItems.filter(
          (i) => !existingItemIds.has(i.id),
        );
        this.checklists = [...this.checklists, ...newChecklists];
        this.checklistItems = [...this.checklistItems, ...newItems];
      }
    });
  }

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
