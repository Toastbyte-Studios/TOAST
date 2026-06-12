import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import { makeAutoObservable, runInAction } from 'mobx';
import DeviceInfo from 'react-native-device-info';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';

export class CoreStore {
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
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
  // ==== Cleanup on store disposal ====
  // --------------------------------------------------------------------
  dispose() {
    this.stopDeviceStatusMonitoring();
  }
}
