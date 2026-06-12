import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useMemo } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import CardTopic from '../../../components/CardTopic';
import Grid from '../../../components/Grid';
import { HorizontalRule } from '../../../components/HorizontalRule';
import { NoteSortSelector } from '../../../components/NoteSortSelector';
import { Text } from '../../../components/ScaledText';
import ScreenBody from '../../../components/ScreenBody';
import SectionHeader from '../../../components/SectionHeader';
import { useNotesStore, useSettingsStore } from '../../../stores';
import { FOOTER_HEIGHT } from '../../../theme';
import { sortNotes } from '../../../utils/noteSorting';

type NoteCategoryRouteProp = RouteProp<
  { NoteCategory: { category: string } },
  'NoteCategory'
>;

/**
 * Displays all notes for a specific category.
 *
 * This screen retrieves the category name from the navigation route parameters
 * and displays all notes belonging to that category in a grid layout using CardTopic components.
 * If no notes are found for the category, a helper message is shown.
 *
 * @returns {JSX.Element} The rendered note category screen component.
 *
 * @remarks
 * - Reads notes from the CoreStore grouped by category.
 * - Navigates back to NotepadScreen when category has no notes.
 * - Similar UI/UX pattern to the Reference module's CategoryScreen.
 */
export default observer(function NoteCategoryScreen(): React.JSX.Element {
<<<<<<< HEAD
  const route = useRoute<NoteCategoryRouteProp>();
  const navigation = useNavigation();
  const core = useCoreStore();
=======
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const core = useNotesStore();
>>>>>>> origin/main
  const settings = useSettingsStore();

  const { category } = route.params || {};
  // Filter out Voice Logs from NotePad screens
  const isValidCategory =
    category && category !== 'Voice Logs' && core.categories.includes(category);
  const notes = useMemo(
    () => (isValidCategory ? (core.notesByCategory[category] ?? []) : []),
    [isValidCategory, category, core.notesByCategory],
  );

  const sortedNotes = useMemo(
    () => sortNotes(notes, settings.noteSortOrder),
    [notes, settings.noteSortOrder],
  );

  return (
    <ScreenBody>
      <SectionHeader>{category}</SectionHeader>
      <NoteSortSelector />
      <HorizontalRule />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {sortedNotes.length === 0 && (
            <Text style={styles.helperText}>
              No notes in this category yet.
            </Text>
          )}
          <Grid>
            {sortedNotes.map((note) => {
              const titleText = note.title || '(Untitled)';
              return (
                <CardTopic
                  key={note.id}
                  title={titleText}
                  icon="document-text-outline"
                  onPress={() => {
                    navigation.navigate('NoteEntry', { note });
                  }}
                />
              );
            })}
          </Grid>
        </ScrollView>
      </View>
    </ScreenBody>
  );
});

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
    width: '100%',
    paddingBottom: 24,
    alignItems: 'center',
  },
  helperText: {
    fontSize: 16,
    opacity: 0.8,
    marginHorizontal: 6,
    marginBottom: 12,
  },
});
