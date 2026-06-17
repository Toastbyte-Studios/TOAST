import { TransformRequestManager } from '@maplibre/maplibre-react-native';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { StoreProvider } from './src/stores';

export default function App() {
  useEffect(() => {
    if (__DEV__) {
      // Attach an identifying header to every outgoing MapLibre tile request.
      // This is good citizenship toward OpenFreeMap and gives us free
      // observability into our tile usage if we ever route through our own
      // infrastructure.  Runs once at mount rather than in the Map component
      // so it applies globally regardless of which screen is active.
      TransformRequestManager.addHeader({
        id: 'toast-app-id',
        name: 'X-App-ID',
        value: 'toast-app',
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StoreProvider>
          <AppNavigator />
        </StoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
