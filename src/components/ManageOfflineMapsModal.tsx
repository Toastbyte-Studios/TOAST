import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import {
  DEFAULT_OFFLINE_ZOOM,
  HIGH_DETAIL_OFFLINE_ZOOM,
  OfflineMapService,
  type OfflineMapPack,
} from '../navigation/services/OfflineMapService';
import { boundsFromRadius } from '../navigation/utils/boundsFromRadius';
import { formatBytes } from '../navigation/utils/formatBytes';
import { useSettingsStore } from '../stores';

interface ManageOfflineMapsModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Invoked when the user taps the empty-state CTA. The host is responsible for
   * dismissing this modal (if desired) and opening the download flow.
   */
  onDownloadArea?: () => void;
}

/**
 * Modal for managing downloaded offline map packs.
 *
 * Lists every offline pack with its metadata, status, and on-disk size; shows
 * total storage used; and offers per-pack Refresh (delete + re-download) and
 * Delete actions, both confirmed. Shows an empty-state CTA when no packs exist.
 *
 * MVP limitations (see PR description):
 * - Refresh re-downloads using the current "High detail" setting rather than
 *   reproducing the pack's original zoom range — pack metadata does not persist
 *   the zoom range, so exact fidelity is out of scope for the MVP.
 * - Only one in-flight download is supported at a time.
 *
 * Note: Uses React Native's Text directly to avoid font-scaling issues in the
 * settings UI, matching SettingsModal.
 */
function describePackArea(pack: OfflineMapPack): string {
  const { centerLat, centerLng, radiusMiles } = pack.metadata;
  const lat = Number.isFinite(centerLat) ? centerLat.toFixed(3) : '—';
  const lng = Number.isFinite(centerLng) ? centerLng.toFixed(3) : '—';
  return `${lat}, ${lng} · ~${radiusMiles} mi radius`;
}

function describePackStatus(pack: OfflineMapPack): string {
  const status = pack.status;
  const required = status.requiredResourceCount ?? 0;
  const completed = status.completedResourceCount ?? 0;
  if (status.state === 'complete') {
    return 'Complete';
  }
  if (status.state === 'active') {
    const pct =
      required > 0 ? Math.round((completed / required) * 100) : 0;
    return `Downloading… ${pct}%`;
  }
  // 'inactive' or any partial state
  if (required > 0 && completed < required) {
    const pct = Math.round((completed / required) * 100);
    return `Inactive · ${pct}% downloaded`;
  }
  return 'Inactive';
}

function formatCreatedAt(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (isNaN(parsed.getTime())) {
    return 'Unknown date';
  }
  return parsed.toLocaleDateString();
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
    totalCardThemed: {
      backgroundColor: COLORS.SECONDARY_ACCENT,
      borderColor: COLORS.TOAST_BROWN,
    },
    packCardThemed: {
      borderColor: COLORS.TOAST_BROWN,
      backgroundColor: COLORS.BACKGROUND,
    },
    buttonDefault: {
      borderColor: COLORS.TOAST_BROWN,
      backgroundColor: COLORS.BACKGROUND,
    },
    emptyCardThemed: {
      borderColor: COLORS.TOAST_BROWN,
      backgroundColor: COLORS.SECONDARY_ACCENT,
    },
    ctaThemed: {
      backgroundColor: COLORS.TOAST_BROWN,
      borderColor: COLORS.PRIMARY_DARK,
    },
  });
}

export const ManageOfflineMapsModal = observer(
  ({ visible, onClose, onDownloadArea }: ManageOfflineMapsModalProps) => {
    const COLORS = useTheme();
    const t = useMemo(() => makeStyles(COLORS), [COLORS]);
    const settingsStore = useSettingsStore();

    const [packs, setPacks] = useState<OfflineMapPack[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [busyPackId, setBusyPackId] = useState<string | null>(null);

    const loadPacks = useCallback(async () => {
      try {
        const next = await OfflineMapService.listPacks();
        setPacks(next);
      } catch (error) {
        console.error('Failed to list offline packs:', error);
        Alert.alert(
          'Could Not Load Maps',
          'Something went wrong reading your downloaded maps. Please try again.',
        );
      }
    }, []);

    // Re-query whenever the modal becomes visible. (A Modal has no navigation
    // focus event, so visibility is the equivalent trigger.)
    useEffect(() => {
      if (!visible) return;
      let ignore = false;
      setLoading(true);
      loadPacks().finally(() => {
        if (!ignore) setLoading(false);
      });
      return () => {
        ignore = true;
      };
    }, [visible, loadPacks]);

    const handlePullToRefresh = useCallback(async () => {
      setRefreshing(true);
      await loadPacks();
      setRefreshing(false);
    }, [loadPacks]);

    const totalBytes = useMemo(
      () =>
        packs.reduce(
          (sum, p) => sum + (p.status?.completedResourceSize ?? 0),
          0,
        ),
      [packs],
    );

    const performDelete = useCallback(
      async (pack: OfflineMapPack) => {
        setBusyPackId(pack.id);
        try {
          await OfflineMapService.deletePack(pack.id);
          await loadPacks();
        } catch (error) {
          console.error('Failed to delete offline pack:', error);
          Alert.alert(
            'Delete Failed',
            'Could not delete this map. Please try again.',
          );
        } finally {
          setBusyPackId(null);
        }
      },
      [loadPacks],
    );

    const confirmDelete = useCallback(
      (pack: OfflineMapPack) => {
        Alert.alert(
          'Delete Offline Map',
          `Delete "${pack.metadata.name}"? This frees up the storage it uses. You can download it again later.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => performDelete(pack),
            },
          ],
        );
      },
      [performDelete],
    );

    const performRefresh = useCallback(
      async (pack: OfflineMapPack) => {
        setBusyPackId(pack.id);
        try {
          const { centerLng, centerLat, radiusMiles } = pack.metadata;
          const bounds = boundsFromRadius(
            { longitude: centerLng, latitude: centerLat },
            radiusMiles,
          );
          // MVP: reuse the current high-detail preference rather than the
          // pack's original zoom range (which isn't persisted in metadata).
          const zoomRange = settingsStore.highDetailOffline
            ? HIGH_DETAIL_OFFLINE_ZOOM
            : DEFAULT_OFFLINE_ZOOM;

          await OfflineMapService.deletePack(pack.id);
          await OfflineMapService.downloadRegion({
            bounds,
            metadata: {
              ...pack.metadata,
              createdAt: new Date().toISOString(),
            },
            zoomRange,
          });
          await loadPacks();
        } catch (error) {
          console.error('Failed to refresh offline pack:', error);
          Alert.alert(
            'Refresh Failed',
            'Could not refresh this map. Please try again.',
          );
        } finally {
          setBusyPackId(null);
        }
      },
      [loadPacks, settingsStore.highDetailOffline],
    );

    const confirmRefresh = useCallback(
      (pack: OfflineMapPack) => {
        Alert.alert(
          'Refresh Offline Map',
          `Refreshing "${pack.metadata.name}" deletes it and downloads it again with fresh tiles. This re-incurs the download size. Continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Refresh',
              onPress: () => performRefresh(pack),
            },
          ],
        );
      },
      [performRefresh],
    );

    const handleDownloadCta = useCallback(() => {
      onClose();
      onDownloadArea?.();
    }, [onClose, onDownloadArea]);

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
            accessibilityLabel="Close manage offline maps modal"
            accessibilityRole="button"
            accessibilityHint="Tap to dismiss"
          />
          <View style={[styles.modalContainer, t.modalContainerThemed]}>
            <View style={[styles.header, t.headerThemed]}>
              <RNText style={[styles.headerText, t.primaryText]}>
                Manage Offline Maps
              </RNText>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close manage offline maps"
                accessibilityRole="button"
              >
                <Ionicons
                  name="close-outline"
                  size={28}
                  color={COLORS.PRIMARY_DARK}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handlePullToRefresh}
                  tintColor={COLORS.PRIMARY_DARK}
                />
              }
            >
              {/* Total storage */}
              <View style={[styles.totalCard, t.totalCardThemed]}>
                <RNText style={[styles.totalLabel, t.primaryText]}>
                  Total storage used
                </RNText>
                <RNText style={[styles.totalValue, t.primaryText]}>
                  {formatBytes(totalBytes)}
                </RNText>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="small"
                    color={COLORS.PRIMARY_DARK}
                  />
                </View>
              ) : packs.length === 0 ? (
                /* Empty state */
                <View style={[styles.emptyCard, t.emptyCardThemed]}>
                  <RNText style={[styles.emptyTitle, t.primaryText]}>
                    No offline maps yet
                  </RNText>
                  <RNText style={[styles.emptyBody, t.primaryText]}>
                    Download your area so the map keeps working without a
                    signal — handy in the backcountry or during an outage.
                  </RNText>
                  {onDownloadArea && (
                    <TouchableOpacity
                      style={[styles.cta, t.ctaThemed]}
                      onPress={handleDownloadCta}
                      accessibilityLabel="Download your area"
                      accessibilityRole="button"
                    >
                      <RNText style={styles.ctaText}>Download your area</RNText>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* Pack list */
                packs.map((pack) => {
                  const isBusy = busyPackId === pack.id;
                  return (
                    <View
                      key={pack.id}
                      style={[styles.packCard, t.packCardThemed]}
                    >
                      <RNText style={[styles.packName, t.primaryText]}>
                        {pack.metadata.name}
                      </RNText>
                      <RNText style={[styles.packMeta, t.primaryText]}>
                        {describePackArea(pack)}
                      </RNText>
                      <RNText style={[styles.packMeta, t.primaryText]}>
                        Created {formatCreatedAt(pack.metadata.createdAt)}
                      </RNText>
                      <View style={styles.packStatusRow}>
                        <RNText style={[styles.packStatus, t.primaryText]}>
                          {describePackStatus(pack)}
                        </RNText>
                        <RNText style={[styles.packSize, t.primaryText]}>
                          {formatBytes(
                            pack.status?.completedResourceSize ?? 0,
                          )}
                        </RNText>
                      </View>

                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={[styles.actionButton, t.buttonDefault]}
                          onPress={() => confirmRefresh(pack)}
                          disabled={isBusy}
                          accessibilityLabel={`Refresh ${pack.metadata.name}`}
                          accessibilityRole="button"
                        >
                          {isBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={COLORS.PRIMARY_DARK}
                            />
                          ) : (
                            <View style={styles.actionButtonInner}>
                              <Ionicons
                                name="refresh-outline"
                                size={18}
                                color={COLORS.PRIMARY_DARK}
                              />
                              <RNText
                                style={[styles.actionText, t.primaryText]}
                              >
                                Refresh
                              </RNText>
                            </View>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, t.buttonDefault]}
                          onPress={() => confirmDelete(pack)}
                          disabled={isBusy}
                          accessibilityLabel={`Delete ${pack.metadata.name}`}
                          accessibilityRole="button"
                        >
                          <View style={styles.actionButtonInner}>
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={COLORS.PRIMARY_DARK}
                            />
                            <RNText style={[styles.actionText, t.primaryText]}>
                              Delete
                            </RNText>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
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
  totalCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.85,
    marginBottom: 16,
  },
  cta: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  packCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 14,
  },
  packName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  packMeta: {
    fontSize: 13,
    opacity: 0.75,
    marginBottom: 2,
  },
  packStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  packStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  packSize: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
