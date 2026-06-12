import { makeAutoObservable } from 'mobx';
import { AstronomyEventStore } from './AstronomyEventStore';
import { BarometerStore } from './BarometerStore';
import { ChecklistStore } from './ChecklistStore';
import { CoreStore } from './CoreStore';
import { EmergencyPlanStore } from './EmergencyPlanStore';
import { InventoryStore } from './InventoryStore';
import { NavigationStore } from './NavigationStore';
import { NotesStore } from './NotesStore';
import { NotificationsStore } from './NotificationsStore';
import { PantryStore } from './PantryStore';
import { ReferenceStore } from './ReferenceStore';
import { RepeaterBookStore } from './RepeaterBookStore';
import { SettingsStore } from './SettingsStore';
import { SignalsStore } from './SignalsStore';
import { SolarCycleNotificationStore } from './SolarCycleNotificationStore';
import { TrackStore } from './TrackStore';
import { WaypointStore } from './WaypointStore';
import { WeatherOutlookStore } from './WeatherOutlookStore';

export class RootStore {
  coreStore: CoreStore;
  notesStore: NotesStore;
  checklistStore: ChecklistStore;
  inventoryStore: InventoryStore;
  pantryStore: PantryStore;
  emergencyPlanStore: EmergencyPlanStore;
  navigationStore: NavigationStore;
  referenceStore: ReferenceStore;
  settingsStore: SettingsStore;
  signalsStore: SignalsStore;
  solarCycleNotificationStore: SolarCycleNotificationStore;
  notificationsStore: NotificationsStore;
  barometerStore: BarometerStore;
  repeaterBookStore: RepeaterBookStore;
  weatherOutlookStore: WeatherOutlookStore;
  waypointStore: WaypointStore;
  trackStore: TrackStore;
  astronomyEventStore: AstronomyEventStore;

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
    this.signalsStore = new SignalsStore();
    this.solarCycleNotificationStore = new SolarCycleNotificationStore();
    this.notificationsStore = new NotificationsStore();
    this.barometerStore = new BarometerStore();
    this.repeaterBookStore = new RepeaterBookStore();
    this.weatherOutlookStore = new WeatherOutlookStore();
    this.waypointStore = new WaypointStore();
    this.trackStore = new TrackStore();
    this.astronomyEventStore = new AstronomyEventStore();
    this.initializeSettings();
  }

  /**
   * Initialize settings by loading them from the database
   */
  private async initializeSettings() {
    // Load persisted notification hidden keys first — this is AsyncStorage-based
    // and has no dependency on the SQLite database, so it can run immediately
    // and avoids a brief window where dismissed notifications appear in the UI.
    await this.notificationsStore.loadHiddenKeys();
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
    this.coreStore = new CoreStore();
    this.notesStore = new NotesStore();
    this.checklistStore = new ChecklistStore();
    this.inventoryStore = new InventoryStore();
    this.pantryStore = new PantryStore();
    this.emergencyPlanStore = new EmergencyPlanStore();
    this.navigationStore = new NavigationStore();
    this.referenceStore = new ReferenceStore();
    this.settingsStore = new SettingsStore();
    this.signalsStore = new SignalsStore();
    this.solarCycleNotificationStore = new SolarCycleNotificationStore();
    this.notificationsStore = new NotificationsStore();
    this.barometerStore = new BarometerStore();
    this.repeaterBookStore = new RepeaterBookStore();
    this.weatherOutlookStore = new WeatherOutlookStore();
    this.waypointStore = new WaypointStore();
    this.trackStore = new TrackStore();
    this.astronomyEventStore = new AstronomyEventStore();
    this.isOfflineMode = true;
    // initializeSettings is intentionally not awaited - settings have sensible
    // defaults and components will re-render when settings finish loading from DB
    this.initializeSettings();
  }
}
