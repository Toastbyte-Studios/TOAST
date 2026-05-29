import { Alert, PermissionsAndroid, Platform } from 'react-native';

/**
 * Requests Android 13+ notification permission used by the foreground-service
 * recording notification. Recording still starts even if denied.
 */
export async function requestForegroundNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return;
  }
  try {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const alreadyGranted = await PermissionsAndroid.check(permission);
    if (alreadyGranted) {
      return;
    }
    const result = await PermissionsAndroid.request(permission, {
      title: 'Notification Permission',
      message:
        'TOAST uses a persistent notification while recording so trail tracking can continue with your screen locked.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'Allow',
    });
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert(
        'Notifications Disabled',
        'Trail recording will still work, but Android may hide the recording notification. You can enable notifications for TOAST later in Settings.',
        [{ text: 'OK' }],
      );
    }
  } catch {
    // Non-fatal — recording still works; notification visibility may vary.
  }
}
