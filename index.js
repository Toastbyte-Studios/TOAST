/**
 * @format
 */

import 'react-native-get-random-values';
import { Alert, AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

enableScreens();

// Capture unhandled JS exceptions so they surface as visible alerts instead of
// silently closing the app in release builds. In debug builds the RN red-screen
// overlay already handles this; we still log to console for Metro/logcat.
const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error(`[TOAST] Unhandled exception (fatal=${isFatal}):`, error);
  if (isFatal && !__DEV__) {
    Alert.alert(
      'Unexpected Error',
      error?.message ?? 'An unknown error occurred. Please restart the app.',
    );
  }
  defaultHandler?.(error, isFatal);
});

AppRegistry.registerComponent(appName, () => App);
