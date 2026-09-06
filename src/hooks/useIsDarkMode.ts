import { reaction } from 'mobx';
import { useEffect, useState } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import { useSettingsStore } from '../stores';
import { ThemeMode } from '../stores/SettingsStore';

/**
 * Resolves whether dark mode is active for a given theme mode and system
 * preference. Mirrors the resolution order used by {@link useTheme}.
 */
function resolveIsDarkMode(
  themeMode: ThemeMode,
  systemColorScheme: ColorSchemeName,
): boolean {
  if (themeMode === 'dark') {
    return true;
  } else if (themeMode === 'light') {
    return false;
  } else {
    return systemColorScheme === 'dark';
  }
}

/**
 * Hook that reports whether dark mode is currently active.
 *
 * `useTheme` already resolves this internally to pick a color scheme, but it
 * only returns the colors. Components that need to branch on the mode itself
 * — swapping an image asset, for example — need the boolean, which is what
 * this hook exposes.
 *
 * Uses the same MobX reaction pattern as `useTheme` so it stays correct in
 * components that are not wrapped in `observer`.
 *
 * @returns `true` when the dark color scheme is active.
 */
export function useIsDarkMode(): boolean {
  const settingsStore = useSettingsStore();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    resolveIsDarkMode(settingsStore.themeMode, systemColorScheme),
  );

  useEffect(() => {
    const dispose = reaction(
      () => settingsStore.themeMode,
      (themeMode) => {
        setIsDarkMode(resolveIsDarkMode(themeMode, systemColorScheme));
      },
      {
        fireImmediately: false,
      },
    );

    // Also update when the system color scheme changes.
    setIsDarkMode(
      resolveIsDarkMode(settingsStore.themeMode, systemColorScheme),
    );

    return dispose;
  }, [settingsStore, systemColorScheme]);

  return isDarkMode;
}
