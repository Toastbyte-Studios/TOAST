import { observer } from 'mobx-react-lite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  ScrollView,
  Text as RNText,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import {
  useChecklistStore,
  useEmergencyPlanStore,
  useInventoryStore,
  useNotesStore,
  usePantryStore,
  useRepeaterBookStore,
  useSettingsStore,
  useTrackStore,
  useWaypointStore,
} from '../stores';
import {
  addBookmark,
  clearBookmarks,
  getBookmarks,
} from '../stores/BookmarksStore';
import {
  FontSize,
  MeasurementSystem,
  ThemeMode,
} from '../stores/SettingsStore';
import {
  BackupData,
  BackupPreview,
  createBackupData,
  createBackupPreview,
  exportBackup,
  listBackupFiles,
  readBackupFile,
} from '../utils/backupService';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Opens the "Manage offline maps" surface. Supplied by the host (AppShell),
   * which owns that modal's visibility and navigation access.
   */
  onManageOfflineMaps?: () => void;
}

/**
 * Settings modal component that overlays on top of the app.
 * Allows users to configure font size, theme mode, and manage data backups.
 *
 * Note: Uses React Native's Text directly to avoid scaling issues in the settings UI.
 */

/** Formats a Unix timestamp (ms) as a locale date-time string. */
function formatBackupDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function hasPersistedCommunicationPlan(
  plan: BackupData['data']['communicationPlan'],
) {
  return Boolean(plan && plan.updatedAt > 0);
}

function makeStyles(COLORS: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    primaryText: { color: COLORS.PRIMARY_DARK },
    modalContainerThemed: {
      backgroundColor: COLORS.PRIMARY_LIGHT,
      borderColor: COLORS.TOAST_BROWN,
    },
    headerThemed: {
      backgroundColor: COLORS.SECONDARY_ACCENT,
      borderBottomColor: COLORS.TOAST_BROWN,
    },
    buttonDefault: {
      borderColor: COLORS.TOAST_BROWN,
      backgroundColor: COLORS.BACKGROUND,
    },
    buttonSelected: {
      backgroundColor: COLORS.TOAST_BROWN,
      borderColor: COLORS.PRIMARY_DARK,
    },
    temperatureButtonDefault: {
      flex: 1,
      borderColor: COLORS.TOAST_BROWN,
      backgroundColor: COLORS.BACKGROUND,
    },
    restorePanelThemed: {
      borderColor: COLORS.TOAST_BROWN,
      backgroundColor: COLORS.SECONDARY_ACCENT,
    },
    fileItemSelected: { backgroundColor: COLORS.TOAST_BROWN },
  });
}

export const SettingsModal = observer(
  ({ visible, onClose, onManageOfflineMaps }: SettingsModalProps) => {
    const settingsStore = useSettingsStore();
    const coreStore = useNotesStore();
    const checklistStore = useChecklistStore();
    const emergencyPlanStore = useEmergencyPlanStore();
    const inventoryStore = useInventoryStore();
    const pantryStore = usePantryStore();
    const repeaterBookStore = useRepeaterBookStore();
    const COLORS = useTheme();
    const trackStore = useTrackStore();
    const t = useMemo(() => makeStyles(COLORS), [COLORS]);
    const waypointStore = useWaypointStore();

    // Backup UI state
    const [isExporting, setIsExporting] = useState(false);
    const [backupFiles, setBackupFiles] = useState<
      { name: string; path: string }[]
    >([]);
    const [showFileList, setShowFileList] = useState(false);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
      null,
    );
    const [selectedBackup, setSelectedBackup] = useState<BackupData | null>(
      null,
    );
    const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(
      null,
    );
    const [isRestoring, setIsRestoring] = useState(false);

    const fontSizeOptions: { value: FontSize; label: string }[] = [
      { value: 'small', label: 'Small' },
      { value: 'medium', label: 'Medium' },
      { value: 'large', label: 'Large' },
    ];

    const themeModeOptions: { value: ThemeMode; label: string }[] = [
      { value: 'light', label: 'Light Mode' },
      { value: 'dark', label: 'Dark Mode' },
      { value: 'system', label: 'System' },
    ];

    const measurementSystemOptions: {
      value: MeasurementSystem;
      label: string;
    }[] = [
      { value: 'imperial', label: 'Imperial (°F, ft, mph)' },
      { value: 'metric', label: 'Metric (°C, m, km/h)' },
    ];

    const handleExport = useCallback(async () => {
      setIsExporting(true);
      try {
        const bookmarks = await getBookmarks();
        const backupData = createBackupData(
          coreStore.notes,
          coreStore.categories,
          checklistStore.checklists,
          checklistStore.checklistItems,
          inventoryStore.items,
          inventoryStore.categories,
          pantryStore.items,
          pantryStore.categories,
          bookmarks,
          {
            fontSize: settingsStore.fontSize,
            themeMode: settingsStore.themeMode,
            noteSortOrder: settingsStore.noteSortOrder,
            measurementSystem: settingsStore.measurementSystem,
          },
          waypointStore.waypoints,
          trackStore.tracks,
          emergencyPlanStore.contacts,
          emergencyPlanStore.rallyPoints,
          hasPersistedCommunicationPlan(emergencyPlanStore.communicationPlan)
            ? emergencyPlanStore.communicationPlan
            : null,
          repeaterBookStore.customRepeaters,
        );
        await exportBackup(backupData);
        await settingsStore.setLastBackupAt(Date.now());
      } catch (error) {
        Alert.alert(
          'Export Failed',
          'Could not export backup. Please try again.',
        );
        console.error('Export failed:', error);
      } finally {
        setIsExporting(false);
      }
    }, [
      checklistStore,
      coreStore,
      emergencyPlanStore,
      inventoryStore,
      pantryStore,
      repeaterBookStore,
      settingsStore,
      trackStore,
      waypointStore,
    ]);

    const handleOpenRestorePanel = useCallback(async () => {
      const files = await listBackupFiles();
      setBackupFiles(files);
      setShowFileList(true);
      setSelectedFilePath(null);
      setSelectedBackup(null);
      setBackupPreview(null);
    }, []);

    const handleSelectFile = useCallback(async (filePath: string) => {
      const data = await readBackupFile(filePath);
      if (!data) {
        Alert.alert(
          'Invalid File',
          'The selected file is not a valid TOAST backup.',
        );
        return;
      }
      setSelectedFilePath(filePath);
      setSelectedBackup(data);
      setBackupPreview(createBackupPreview(data));
    }, []);

    const handleRestore = useCallback(
      async (mode: 'replace' | 'merge') => {
        if (!selectedBackup) {
          return;
        }
        setIsRestoring(true);
        try {
          const { data } = selectedBackup;

          // Restore bookmarks
          if (mode === 'replace') {
            await clearBookmarks();
          }
          for (const bookmark of data.bookmarks) {
            await addBookmark(bookmark);
          }

          // Restore notes and categories
          await coreStore.importNotesData(
            data.noteCategories,
            data.notes,
            mode,
          );

          // Restore checklists
          await checklistStore.importChecklistsData(
            data.checklists,
            data.checklistItems,
            mode,
          );

          // Restore inventory
          await inventoryStore.importData(
            data.inventoryCategories,
            data.inventoryItems,
            mode,
          );

          // Restore pantry
          await pantryStore.importData(
            data.pantryCategories,
            data.pantryItems,
            mode,
          );

          await waypointStore.importData(data.waypoints, mode);
          await trackStore.importData(data.tracks, mode);
          await emergencyPlanStore.importData(
            data.emergencyContacts,
            data.rallyPoints,
            data.communicationPlan,
            mode,
          );
          await repeaterBookStore.importCustomRepeaters(
            data.customRepeaters,
            mode,
          );

          // Restore settings — only applied in replace mode, overwriting current preferences
          if (mode === 'replace' && data.settings) {
            if (data.settings.fontSize) {
              await settingsStore.setFontSize(data.settings.fontSize);
            }
            if (data.settings.themeMode) {
              await settingsStore.setThemeMode(data.settings.themeMode);
            }
            if (data.settings.noteSortOrder) {
              await settingsStore.setNoteSortOrder(data.settings.noteSortOrder);
            }
            if (data.settings.measurementSystem) {
              await settingsStore.setMeasurementSystem(
                data.settings.measurementSystem,
              );
            }
          }

          setShowFileList(false);
          setSelectedFilePath(null);
          setSelectedBackup(null);
          setBackupPreview(null);
          Alert.alert('Restore Complete', 'Your data has been restored.');
        } catch (error) {
          Alert.alert(
            'Restore Failed',
            'Could not restore backup. Please try again.',
          );
          console.error('Restore failed:', error);
        } finally {
          setIsRestoring(false);
        }
      },
      [
        selectedBackup,
        checklistStore,
        coreStore,
        emergencyPlanStore,
        inventoryStore,
        pantryStore,
        repeaterBookStore,
        settingsStore,
        trackStore,
        waypointStore,
      ],
    );

    const confirmRestore = useCallback(
      (mode: 'replace' | 'merge') => {
        const modeLabel =
          mode === 'replace'
            ? 'replace all existing data'
            : 'merge with existing data';
        Alert.alert('Confirm Restore', `This will ${modeLabel}. Continue?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => handleRestore(mode),
          },
        ]);
      },
      [handleRestore],
    );

    const handleManageOfflineMaps = useCallback(() => {
      // Close settings first so the two modals don't stack on top of each other.
      onClose();
      onManageOfflineMaps?.();
    }, [onClose, onManageOfflineMaps]);

    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close settings modal"
            accessibilityRole="button"
            accessibilityHint="Tap to dismiss the settings"
          />
          <View style={[styles.modalContainer, t.modalContainerThemed]}>
            <View style={[styles.header, t.headerThemed]}>
              <RNText style={[styles.headerText, t.primaryText]}>
                Settings
              </RNText>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close settings"
                accessibilityRole="button"
              >
                <Ionicons
                  name="close-outline"
                  size={28}
                  color={COLORS.PRIMARY_DARK}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              {/* Font Size Section */}
              <View style={styles.section}>
                <RNText style={[styles.sectionTitle, t.primaryText]}>
                  Font Size
                </RNText>
                <View style={styles.optionsContainer}>
                  {fontSizeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        t.buttonDefault,
                        settingsStore.fontSize === option.value &&
                          t.buttonSelected,
                      ]}
                      onPress={() => settingsStore.setFontSize(option.value)}
                      accessibilityLabel={`Set font size to ${option.label}`}
                      accessibilityRole="button"
                    >
                      <RNText
                        style={[
                          styles.optionText,
                          t.primaryText,
                          settingsStore.fontSize === option.value &&
                            styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </RNText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Theme Mode Section */}
              <View style={styles.section}>
                <RNText style={[styles.sectionTitle, t.primaryText]}>
                  Theme
                </RNText>
                <View style={styles.optionsContainer}>
                  {themeModeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        t.buttonDefault,
                        settingsStore.themeMode === option.value &&
                          t.buttonSelected,
                      ]}
                      onPress={() => settingsStore.setThemeMode(option.value)}
                      accessibilityLabel={`Set theme to ${option.label}`}
                      accessibilityRole="button"
                    >
                      <RNText
                        style={[
                          styles.optionText,
                          t.primaryText,
                          settingsStore.themeMode === option.value &&
                            styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </RNText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Measurement System Section */}
              <View style={styles.section}>
                <RNText style={[styles.sectionTitle, t.primaryText]}>
                  Measurement System
                </RNText>
                <View
                  style={[styles.optionsContainer, styles.optionsContainerRow]}
                >
                  {measurementSystemOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        t.temperatureButtonDefault,
                        settingsStore.measurementSystem === option.value &&
                          t.buttonSelected,
                      ]}
                      onPress={() =>
                        settingsStore.setMeasurementSystem(option.value)
                      }
                      accessibilityLabel={`Set measurement system to ${option.label}`}
                      accessibilityRole="button"
                    >
                      <RNText
                        style={[
                          styles.optionText,
                          t.primaryText,
                          settingsStore.measurementSystem === option.value &&
                            styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </RNText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Offline Maps Section */}
              <View style={styles.section}>
                <RNText style={[styles.sectionTitle, t.primaryText]}>
                  Offline Maps
                </RNText>

                {/* High-detail toggle */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabel}>
                    <RNText style={[styles.toggleTitle, t.primaryText]}>
                      High detail (z8–14)
                    </RNText>
                    <RNText style={[styles.toggleHint, t.primaryText]}>
                      New downloads include building detail. Uses ~2× storage.
                    </RNText>
                  </View>
                  <Switch
                    value={settingsStore.highDetailOffline}
                    onValueChange={(value) =>
                      settingsStore.setHighDetailOffline(value)
                    }
                    trackColor={{ true: COLORS.TOAST_BROWN }}
                    accessibilityLabel="Toggle high detail for new offline downloads"
                  />
                </View>

                {/* Manage offline maps entry */}
                <TouchableOpacity
                  style={[styles.actionButton, t.buttonDefault]}
                  onPress={handleManageOfflineMaps}
                  accessibilityLabel="Manage offline maps"
                  accessibilityRole="button"
                >
                  <View style={styles.actionButtonInner}>
                    <Ionicons
                      name="map-outline"
                      size={20}
                      color={COLORS.PRIMARY_DARK}
                    />
                    <RNText style={[styles.actionButtonText, t.primaryText]}>
                      Manage offline maps
                    </RNText>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Data & Backup Section */}
              <View style={styles.section}>
                <RNText style={[styles.sectionTitle, t.primaryText]}>
                  Data &amp; Backup
                </RNText>

                {/* Last backup timestamp */}
                <RNText style={[styles.backupStatus, t.primaryText]}>
                  {settingsStore.lastBackupAt
                    ? `Last backed up: ${formatBackupDate(settingsStore.lastBackupAt)}`
                    : 'No backup yet'}
                </RNText>

                {/* Export Now button */}
                <TouchableOpacity
                  style={[styles.actionButton, t.buttonDefault]}
                  onPress={handleExport}
                  disabled={isExporting}
                  accessibilityLabel="Export backup now"
                  accessibilityRole="button"
                >
                  {isExporting ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.PRIMARY_DARK}
                    />
                  ) : (
                    <View style={styles.actionButtonInner}>
                      <Ionicons
                        name="share-outline"
                        size={20}
                        color={COLORS.PRIMARY_DARK}
                      />
                      <RNText style={[styles.actionButtonText, t.primaryText]}>
                        Export Now
                      </RNText>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Restore from Backup button */}
                <TouchableOpacity
                  style={[styles.actionButton, t.buttonDefault]}
                  onPress={handleOpenRestorePanel}
                  accessibilityLabel="Restore from backup"
                  accessibilityRole="button"
                >
                  <View style={styles.actionButtonInner}>
                    <Ionicons
                      name="cloud-download-outline"
                      size={20}
                      color={COLORS.PRIMARY_DARK}
                    />
                    <RNText style={[styles.actionButtonText, t.primaryText]}>
                      Restore from Backup
                    </RNText>
                  </View>
                </TouchableOpacity>

                {/* Restore panel — file list */}
                {showFileList && (
                  <View style={[styles.restorePanel, t.restorePanelThemed]}>
                    <View style={styles.restorePanelHeader}>
                      <RNText style={[styles.restorePanelTitle, t.primaryText]}>
                        Select a Backup File
                      </RNText>
                      <TouchableOpacity
                        onPress={() => {
                          setShowFileList(false);
                          setSelectedFilePath(null);
                          setSelectedBackup(null);
                          setBackupPreview(null);
                        }}
                        accessibilityLabel="Close restore panel"
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={22}
                          color={COLORS.PRIMARY_DARK}
                        />
                      </TouchableOpacity>
                    </View>

                    {backupFiles.length === 0 ? (
                      <RNText style={[styles.noFilesText, t.primaryText]}>
                        No backup files found. Export a backup first, then save
                        it to your Documents folder to restore.
                      </RNText>
                    ) : (
                      backupFiles.map((file) => (
                        <TouchableOpacity
                          key={file.path}
                          style={[
                            styles.fileItem,
                            t.buttonDefault,
                            selectedFilePath === file.path &&
                              t.fileItemSelected,
                          ]}
                          onPress={() => handleSelectFile(file.path)}
                          accessibilityLabel={`Select backup file ${file.name}`}
                          accessibilityRole="button"
                        >
                          <RNText style={[styles.fileName, t.primaryText]}>
                            {file.name}
                          </RNText>
                        </TouchableOpacity>
                      ))
                    )}

                    {/* Backup preview and restore options */}
                    {backupPreview && (
                      <View style={styles.previewContainer}>
                        <RNText style={[styles.previewTitle, t.primaryText]}>
                          Backup from {backupPreview.backupDate}
                        </RNText>
                        <RNText style={[styles.previewText, t.primaryText]}>
                          {backupPreview.pantryItemCount} pantry items,{' '}
                          {backupPreview.inventoryItemCount} inventory items,{' '}
                          {backupPreview.noteCount} notes,{' '}
                          {backupPreview.checklistCount} checklists,{' '}
                          {backupPreview.bookmarkCount} bookmarks,{' '}
                          {backupPreview.waypointCount} waypoints,{' '}
                          {backupPreview.trackCount} tracks,{' '}
                          {backupPreview.emergencyContactCount} emergency
                          contacts, {backupPreview.rallyPointCount} rally
                          points, {backupPreview.communicationPlanCount}{' '}
                          communication plans,{' '}
                          {backupPreview.customRepeaterCount} custom repeaters
                        </RNText>
                        <View style={styles.restoreButtons}>
                          <TouchableOpacity
                            style={[
                              styles.restoreButton,
                              t.buttonDefault,
                              isRestoring && styles.restoreButtonDisabled,
                            ]}
                            onPress={() => confirmRestore('replace')}
                            disabled={isRestoring}
                            accessibilityLabel="Replace all data with backup"
                            accessibilityRole="button"
                          >
                            {isRestoring ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.PRIMARY_DARK}
                              />
                            ) : (
                              <RNText
                                style={[
                                  styles.restoreButtonText,
                                  t.primaryText,
                                ]}
                              >
                                Replace
                              </RNText>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.restoreButton,
                              t.buttonDefault,
                              isRestoring && styles.restoreButtonDisabled,
                            ]}
                            onPress={() => confirmRestore('merge')}
                            disabled={isRestoring}
                            accessibilityLabel="Merge backup with existing data"
                            accessibilityRole="button"
                          >
                            {isRestoring ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.PRIMARY_DARK}
                              />
                            ) : (
                              <RNText
                                style={[
                                  styles.restoreButtonText,
                                  t.primaryText,
                                ]}
                              >
                                Merge
                              </RNText>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Attribution Section */}
              <View style={styles.section}>
                <RNText style={[styles.sectionTitle, t.primaryText]}>
                  Attributions
                </RNText>
                <RNText style={[styles.attributionText, t.primaryText]}>
                  Knot diagrams sourced from Wikimedia Commons contributors,
                  licensed under CC BY-SA 3.0
                  (https://creativecommons.org/licenses/by-sa/3.0/) except where
                  noted as Public Domain.
                </RNText>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 500,
    borderRadius: 16,
    borderWidth: 3,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  optionsContainer: {
    gap: 12,
  },
  optionsContainerRow: {
    flexDirection: 'row',
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleLabel: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleHint: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  backupStatus: {
    fontSize: 13,
    marginBottom: 12,
    opacity: 0.7,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  restorePanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  restorePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  restorePanelTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  noFilesText: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 18,
  },
  fileItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '500',
  },
  previewContainer: {
    marginTop: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    opacity: 0.85,
    marginBottom: 10,
    lineHeight: 18,
  },
  restoreButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  restoreButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  restoreButtonDisabled: {
    opacity: 0.5,
  },
  attributionText: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.85,
  },
});
