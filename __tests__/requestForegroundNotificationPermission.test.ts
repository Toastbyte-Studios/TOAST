/**
 * @format
 */

type MockState = {
  os: 'android' | 'ios';
  version: number;
  checkResult: boolean;
  requestResult: string;
};

describe('requestForegroundNotificationPermission', () => {
  const setup = (state: MockState) => {
    jest.resetModules();
    const alert = jest.fn();
    const check = jest.fn().mockResolvedValue(state.checkResult);
    const request = jest.fn().mockResolvedValue(state.requestResult);

    jest.doMock('react-native', () => ({
      Alert: { alert },
      PermissionsAndroid: {
        PERMISSIONS: {
          POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
        },
        RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
        check,
        request,
      },
      Platform: { OS: state.os, Version: state.version },
    }));

    const mod = require('../src/screens/Map/requestForegroundNotificationPermission');
    return { ...mod, alert, check, request };
  };

  test('skips permission request on non-Android platforms', async () => {
    const { requestForegroundNotificationPermission, check, request, alert } =
      setup({
        os: 'ios',
        version: 18,
        checkResult: false,
        requestResult: 'denied',
      });

    await requestForegroundNotificationPermission();

    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  test('skips permission request on Android versions below API 33', async () => {
    const { requestForegroundNotificationPermission, check, request, alert } =
      setup({
        os: 'android',
        version: 32,
        checkResult: false,
        requestResult: 'denied',
      });

    await requestForegroundNotificationPermission();

    expect(check).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  test('does not request again when already granted', async () => {
    const { requestForegroundNotificationPermission, check, request, alert } =
      setup({
        os: 'android',
        version: 33,
        checkResult: true,
        requestResult: 'denied',
      });

    await requestForegroundNotificationPermission();

    expect(check).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
    expect(request).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  test('shows explanation when user denies notification permission', async () => {
    const { requestForegroundNotificationPermission, request, alert } = setup({
      os: 'android',
      version: 33,
      checkResult: false,
      requestResult: 'denied',
    });

    await requestForegroundNotificationPermission();

    expect(request).toHaveBeenCalledWith(
      'android.permission.POST_NOTIFICATIONS',
      {
        title: 'Notification Permission',
        message:
          'TOAST uses a persistent notification while recording so trail tracking can continue with your screen locked.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      },
    );
    expect(alert).toHaveBeenCalledWith(
      'Notifications Disabled',
      'Trail recording will still work, but Android may hide the recording notification. You can enable notifications for TOAST later in Settings.',
      [{ text: 'OK' }],
    );
  });
});
