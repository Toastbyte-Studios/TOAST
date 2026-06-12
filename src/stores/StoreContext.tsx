import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { RootStore } from './RootStore';

const StoreContext = createContext<RootStore | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const rootStore = React.useMemo(() => new RootStore(), []);

  // Initialize and load persisted notes and checklists from SQLite on app start
  // Also start device status monitoring for instant battery estimate
  useEffect(() => {
    // Start device status monitoring immediately (synchronously)
    rootStore.coreStore.startDeviceStatusMonitoring();

    // Load persisted data asynchronously
    (async () => {
      try {
        await rootStore.startupPromise;
        if (rootStore.notesStore.notesDb) {
          // Start barometer collection now that the DB is available so pressure
          // history accumulates while the user uses the app, not just while the
          // Barometric Pressure screen is open.
          rootStore.barometerStore.start(rootStore.notesStore.notesDb);
        }
        await rootStore.notesStore.loadNotes();
        await rootStore.checklistStore.loadChecklists();
      } catch (e) {
        console.warn('Failed to load data on startup:', e);
      }
    })();

    // Cleanup device status monitoring on unmount
    return () => {
      rootStore.coreStore.stopDeviceStatusMonitoring();
      rootStore.barometerStore.stop();
    };
  }, [rootStore]);

  return (
    <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>
  );
};

export const useStores = (): RootStore => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStores must be used within a StoreProvider');
  }
  return context;
};

// Convenience hooks for individual stores
export const useCoreStore = () => useStores().coreStore;
export const useSignalingStore = () => useStores().signalingStore;
export const useNotesStore = () => useStores().notesStore;
export const useChecklistStore = () => useStores().checklistStore;
export const useInventoryStore = () => useStores().inventoryStore;
export const usePantryStore = () => useStores().pantryStore;
export const useEmergencyPlanStore = () => useStores().emergencyPlanStore;
export const useNavigationStore = () => useStores().navigationStore;
export const useReferenceStore = () => useStores().referenceStore;
export const useSettingsStore = () => useStores().settingsStore;
export const useSignalsStore = () => useStores().signalsStore;
export const useSolarCycleNotificationStore = () =>
  useStores().solarCycleNotificationStore;
export const useNotificationsStore = () => useStores().notificationsStore;
export const useBarometerStore = () => useStores().barometerStore;
export const useRepeaterBookStore = () => useStores().repeaterBookStore;
export const useWeatherOutlookStore = () => useStores().weatherOutlookStore;
export const useWaypointStore = () => useStores().waypointStore;
export const useTrackStore = () => useStores().trackStore;
export const useAstronomyEventStore = () => useStores().astronomyEventStore;
