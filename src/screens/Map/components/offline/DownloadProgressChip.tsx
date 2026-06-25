import { observer } from 'mobx-react-lite';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import type { OfflineDownloadStore } from '../../../../stores/OfflineDownloadStore';

type Props = {
  store: OfflineDownloadStore;
};

/**
 * Non-blocking progress chip that sits in the top-left of the map container.
 * Persists across navigation because it's mounted on MapScreen (which stays
 * in the stack) and reads from the MobX store. Hidden when state is 'inactive'.
 */
const DownloadProgressChip = observer(function DownloadProgressChip({
  store,
}: Props) {
  const COLORS = useTheme();

  // ── Success toast ──────────────────────────────────────────────────────────────
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const prevStateRef = useRef(store.state);

  useEffect(() => {
    if (prevStateRef.current !== 'complete' && store.state === 'complete') {
      setShowToast(true);
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowToast(false);
        store.clear();
      });
    }
    prevStateRef.current = store.state;
  }, [store.state, store, toastOpacity]);

  // ── Render ──────────────────────────────────────────────────────────────────────

  if (showToast) {
    return (
      <Animated.View
        style={[styles.toast, { opacity: toastOpacity }]}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.toastText}>
          ✅ Offline map ready — works in airplane mode
        </Text>
      </Animated.View>
    );
  }

  if (store.state === 'inactive' || store.state === 'complete') {
    return null;
  }

  if (store.state === 'error') {
    return (
      <DownloadErrorBanner
        message={store.errorMessage ?? 'Download failed'}
        onRetry={() => store.clear()}
        COLORS={COLORS}
      />
    );
  }

  // state === 'active'
  return (
    <View
      style={styles.chip}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Downloading map: ${store.percentage}%`}
    >
      <Text style={styles.chipText}>
        ⤓ Downloading map: {store.percentage}%
        {store.completedResourceCount > 0
          ? ` · ${store.completedMB} MB`
          : ''}
      </Text>
    </View>
  );
});

export default DownloadProgressChip;

// ── DownloadErrorBanner ──────────────────────────────────────────────────────────────

function classifyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('disk') || lower.includes('storage') || lower.includes('space')) {
    return 'Not enough storage. Free up space and try again.';
  }
  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('internet') ||
    lower.includes('connection')
  ) {
    return 'No network connection. Connect to Wi-Fi or cellular and retry.';
  }
  if (lower.includes('tile') || lower.includes('server') || lower.includes('http')) {
    return 'Tile server unreachable. Check your connection and retry.';
  }
  return message;
}

type BannerProps = {
  message: string;
  onRetry: () => void;
  COLORS: ReturnType<typeof useTheme>;
};

function DownloadErrorBanner({ message, onRetry, COLORS }: BannerProps) {
  return (
    <View
      style={[styles.errorBanner, { borderColor: COLORS.ERROR }]}
      accessibilityLiveRegion="assertive"
    >
      <Text style={[styles.errorText, { color: COLORS.ERROR }]} numberOfLines={2}>
        ⚠️ {classifyError(message)}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        accessibilityLabel="Dismiss download error"
        accessibilityRole="button"
      >
        <Text style={[styles.retryText, { color: COLORS.ERROR }]}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '80%',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  toast: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
