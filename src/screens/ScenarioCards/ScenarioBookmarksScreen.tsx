import { useNavigation } from '@react-navigation/native';
import React, { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import CardTopic from '../../components/CardTopic';
import Grid from '../../components/Grid';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import scenarioData from '../../data/scenarioCards.json';
import {
  getBookmarks,
  BookmarkItem,
  clearBookmarks,
} from '../../stores/BookmarksStore';
import { FOOTER_HEIGHT } from '../../theme';
import { ScenarioCardType } from '../../types/data-type';

/**
 * Displays a list of bookmarked scenario cards for the user.
 *
 * - Fetches bookmarks using `getBookmarks` and displays them in a grid.
 * - Navigates to the detailed view of a scenario when a bookmark is selected.
 * - Shows a helper message if there are no bookmarks.
 * - Reloads bookmarks whenever the screen gains focus.
 *
 * @component
 * @returns {JSX.Element} The rendered scenario bookmarks screen.
 */
export default function ScenarioBookmarksScreen(): JSX.Element {
  const navigation = useNavigation();
  const [items, setItems] = useState<BookmarkItem[]>([]);

  // Create a Map for O(1) lookup performance instead of O(n) for each find operation
  // Using useMemo to lazily initialize only when component mounts
  const scenarioMap = useMemo(() => {
    const allScenarios = scenarioData.entries;

    // Development-time check for duplicate IDs
    if (__DEV__) {
      const ids = allScenarios.map((scenario) => scenario.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.error(
          'Duplicate scenario IDs detected in scenarioCards.json. This may cause scenarios to be overwritten.',
        );
      }
    }

    return new Map<string, ScenarioCardType>(
      allScenarios.map((scenario) => [scenario.id, scenario]),
    );
  }, []);

  const load = useCallback(async () => {
    const list = await getBookmarks();
    // Filter to only show bookmarks that exist in scenario data
    const scenarioBookmarks = list.filter((item) => scenarioMap.has(item.id));
    setItems(scenarioBookmarks);
  }, [scenarioMap]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [navigation, load]);

  /**
   * Opens the bookmarked scenario associated with the given bookmark item.
   *
   * Looks up the corresponding scenario in {@link scenarioMap} using the bookmark's `id`.
   * If no scenario is found, logs a warning and exits without navigating.
   * Otherwise, navigates to the `ScenarioDetail` screen, passing the resolved scenario as a route param.
   *
   * @param item - The bookmark item whose associated scenario should be opened.
   */
  const handleOpen = (item: BookmarkItem) => {
    const scenario = scenarioMap.get(item.id);

    if (!scenario) {
      console.warn('Bookmarked scenario not found for id:', item.id);
      return;
    }

    navigation.navigate('ScenarioDetail', { scenario });
  };

  return (
    <ScreenBody>
      <SectionHeader>Bookmarked Scenarios</SectionHeader>

      {/* DEV ONLY - Clear all bookmarks */}
      {__DEV__ && (
        <Text
          onPress={async () => {
            await clearBookmarks();
            await load();
          }}
          style={styles.dev}
        >
          Clear all bookmarks (dev)
        </Text>
      )}
      {/* END DEV ONLY */}

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {items.length === 0 && (
            <Text style={styles.helperText}>No bookmarked scenarios yet.</Text>
          )}
          {items.length > 0 && (
            <Grid>
              {items
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((item) => (
                  <CardTopic
                    key={item.id}
                    title={item.title}
                    icon="document-text-outline"
                    onPress={() => handleOpen(item)}
                  />
                ))}
            </Grid>
          )}
        </ScrollView>
      </View>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingBottom: FOOTER_HEIGHT,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 2,
    paddingBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 16,
    opacity: 0.8,
    marginHorizontal: 2,
    marginTop: 12,
  },
  dev: { marginBottom: 8, opacity: 0.7 },
});
