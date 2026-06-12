import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useMemo } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import CardTopic from '../../components/CardTopic';
import Grid from '../../components/Grid';
import { HorizontalRule } from '../../components/HorizontalRule';
import { NoteSortSelector } from '../../components/NoteSortSelector';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useNotesStore, useSettingsStore } from '../../stores';
import { FOOTER_HEIGHT } from '../../theme';
import { sortNotes } from '../../utils/noteSorting';

/**
 * Displays all bookmarked notes.
 *
 * This screen displays all notes that have been bookmarked by the user
 * in a grid layout using CardTopic components. If no bookmarked notes exist,
 * a helper message is shown.
 *
 * @returns {JSX.Element} The rendered bookmarked notes screen component.
 *
 * @remarks
 * - Reads bookmarked notes from the CoreStore.
 * - Similar UI/UX pattern to the NoteCategoryScreen.
 * - Notes are sorted by creation date (most recent first).
 */
export default observer(function BookmarkedNotesScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const core = useNotesStore();
  const settings = useSettingsStore();

  const bookmarkedNotes = useMemo(
    () => core.bookmarkedNotes,
    [core.bookmarkedNotes],
  );

  const sortedNotes = useMemo(
    () => sortNotes(bookmarkedNotes, settings.noteSortOrder),
    [bookmarkedNotes, settings.noteSortOrder],
  );

  return (
    <ScreenBody>
      <SectionHeader>Bookmarked Notes</SectionHeader>
      <NoteSortSelector />
      <HorizontalRule />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {sortedNotes.length === 0 && (
            <Text style={styles.helperText}>No bookmarked notes yet.</Text>
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
