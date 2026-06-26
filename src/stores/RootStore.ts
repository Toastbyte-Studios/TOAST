import { makeAutoObservable } from 'mobx';
import { AstronomyEventStore } from './AstronomyEventStore';
import { BarometerStore } from './BarometerStore';
import { ChecklistStore } from './ChecklistStore';
import { CoreStore } from './CoreStore';
import { DevToolsStore } from './DevToolsStore';
import { EmergencyPlanStore } from './EmergencyPlanStore';
import { InventoryStore } from './InventoryStore';
import { NavigationStore } from './NavigationStore';
import { NotesStore } from './NotesStore';
import { NotificationsStore } from './NotificationsStore';
import { OfflineDownloadStore } from './OfflineDownloadStore';
import { PantryStore } from './PantryStore';
import { ReferenceStore } from './ReferenceStore';
import { RepeaterBookStore } from './RepeaterBookStore';
import { SettingsStore } from './SettingsStore';
import { SignalingStore } from './SignalingStore';
import { SignalsStore } from './SignalsStore';
import { SolarCycleNotificationStore } from './SolarCycleNotificationStore';
import { TrackStore } from './TrackStore';
import { WaypointStore } from './WaypointStore';
import { WeatherOutlookStore } from './WeatherOutlookStore';

export class RootStore {
  startupPromise: Promise<void>;
  coreStore: CoreStore;
  notesStore: NotesStore;
  checklistStore: ChecklistStore;
  inventoryStore: InventoryStore;
  pantryStore: PantryStore;
  emergencyPlanStore: EmergencyPlanStore;
  navigationStore: NavigationStore;
  referenceStore: ReferenceStore;
  settingsStore: SettingsStore;
  signalingStore: SignalingStore;
  signalsStore: SignalsStore;
  solarCycleNotificationStore: SolarCycleNotificationStore;
  notificationsStore: NotificationsStore;
  barometerStore: BarometerStore;
  repeaterBookStore: RepeaterBookStore;
  weatherOutlookStore: WeatherOutlookStore;
  waypointStore: WaypointStore;
  trackStore: TrackStore;
  astronomyEventStore: AstronomyEventStore;
  offlineDownloadStore: OfflineDownloadStore;
  devToolsStore: DevToolsStore;

  constructor() {
    makeAutoObservable(this);
    this.coreStore = new CoreStore();
    this.notesStore = new NotesStore();
    this.checklistStore = new ChecklistStore();
    this.inventoryStore = new InventoryStore();
    this.pantryStore = new PantryStore();
    this.emergencyPlanStore = new EmergencyPlanStore();
    this.navigationStore = new NavigationStore();
    this.referenceStore = new ReferenceStore();
    this.settingsStore = new SettingsStore();
    this.signalingStore = new SignalingStore();
    this.signalsStore = new SignalsStore();
    this.solarCycleNotificationStore = new SolarCycleNotificationStore();
    this.notificationsStore = new NotificationsStore();
    this.barometerStore = new BarometerStore();
    this.repeaterBookStore = new RepeaterBookStore();
    this.weatherOutlookStore = new WeatherOutlookStore();
    this.waypointStore = new WaypointStore();
    this.trackStore = new TrackStore();
    this.astronomyEventStore = new AstronomyEventStore();
    this.offlineDownloadStore = new OfflineDownloadStore();
    this.devToolsStore = new DevToolsStore();
    this.startupPromise = this.initializeSettings();
  }

  /**
   * Initialize settings by loading them from the database
   */
  private async initializeSettings() {
    // Load persisted notification hidden keys first — AsyncStorage-based,
    // no SQLite dependency, avoids a brief window where dismissed notifications reappear.
    await this.notificationsStore.loadHiddenKeys();
    // Recover any in-progress offline download and re-attach listeners.
    // AsyncStorage-based and safe to run before the SQLite DB is ready.
    await this.offlineDownloadStore.recover();
    // Wait for NotesStore to initialize the database, then load categories and settings
    await this.notesStore.initNotesDb();
    if (this.notesStore.notesDb) {
      // Load categories first to ensure dependent logic sees a consistent category list
      await this.notesStore.loadCategories();
      await this.checklistStore.initDatabase(this.notesStore.notesDb);
      await this.settingsStore.loadSettings(this.notesStore.notesDb);
      // Initialize solar cycle notification store with same database
      await this.solarCycleNotificationStore.initDatabase(
        this.notesStore.notesDb,
      );
      await this.solarCycleNotificationStore.loadSettings();
      // Initialize weather outlook cache table
      await this.weatherOutlookStore.initDatabase(this.notesStore.notesDb);
      // Initialize waypoint store with same database
      await this.waypointStore.initDatabase(this.notesStore.notesDb);
      // Initialize track store with same database
      await this.trackStore.initDatabase(this.notesStore.notesDb);
    }
    // Initialize inventory and pantry databases
    await this.inventoryStore.initDatabase();
    await this.pantryStore.initDatabase();
    await this.emergencyPlanStore.initDatabase();
  }

  // Global app state
  isOfflineMode: boolean = true;

  toggleOfflineMode() {
    this.isOfflineMode = !this.isOfflineMode;
  }

  // Reset all stores
  reset() {
    this.coreStore.dispose();
    this.signalingStore.dispose();
    this.notesStore.dispose();
    this.checklistStore.dispose();
    this.inventoryStore.dispose();
    this.pantryStore.dispose();
    this.emergencyPlanStore.dispose();
    this.solarCycleNotificationStore.dispose();
    this.barometerStore.stop();
    this.repeaterBookStore.dispose();
    this.weatherOutlookStore.dispose();
    this.waypointStore.dispose();
    this.trackStore.dispose();
    this.astronomyEventStore.dispose();
    this.offlineDownloadStore.dispose();
    this.coreStore = new CoreStore();
    this.notesStore = new NotesStore();
    this.checklistStore = new ChecklistStore();
    this.inventoryStore = new InventoryStore();
    this.pantryStore = new PantryStore();
    this.emergencyPlanStore = new EmergencyPlanStore();
    this.navigationStore = new NavigationStore();
    this.referenceStore = new ReferenceStore();
    this.settingsStore = new SettingsStore();
    this.signalingStore = new SignalingStore();
    this.signalsStore = new SignalsStore();
    this.solarCycleNotificationStore = new SolarCycleNotificationStore();
    this.notificationsStore = new NotificationsStore();
    this.barometerStore = new BarometerStore();
    this.repeaterBookStore = new RepeaterBookStore();
    this.weatherOutlookStore = new WeatherOutlookStore();
    this.waypointStore = new WaypointStore();
    this.trackStore = new TrackStore();
    this.astronomyEventStore = new AstronomyEventStore();
    this.offlineDownloadStore = new OfflineDownloadStore();
    this.devToolsStore = new DevToolsStore();
    this.isOfflineMode = true;
    // initializeSettings is intentionally not awaited - settings have sensible
    // defaults and components will re-render when settings finish loading from DB
    this.startupPromise = this.initializeSettings();
  }
}
