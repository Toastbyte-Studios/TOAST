import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CardTopic from '../../components/CardTopic';
import Grid from '../../components/Grid';
import { HorizontalRule } from '../../components/HorizontalRule';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useNotesStore } from '../../stores';

/**
 * Notepad landing screen.
 *
 * @remarks
 * Presents a dashboard of note-related actions and routes:
 * - **New Note** → navigates to the `NewNote` screen
 * - **Recent Notes** → navigates to the `RecentNotes` screen
 * - **Saved Notes** → navigates to the `SavedNotes` screen
 * - **Note Categories** → mapped as CardTopic cards that navigate to category-specific screens
 *
 * Uses React Navigation to perform screen transitions from card taps.
 *
 * @returns A screen layout containing a header, action buttons, and a grid of navigation cards.
 */
export default observer(function NotepadScreen() {
  const navigation = useNavigation<any>();
  const core = useNotesStore();
  const COLORS = useTheme();

  const categoryIcons: Record<string, string> = {
    General: 'folder-outline',
    Work: 'briefcase-outline',
    Personal: 'heart-outline',
    Ideas: 'bulb-outline',
  };
  return (
    <ScreenBody>
      <SectionHeader>Notepad</SectionHeader>
      <View style={styles.noteHeader}>
        <TouchableOpacity
          style={styles.noteButton}
          onPress={() => navigation.navigate('NewNote')}
          accessibilityLabel="New Note"
          accessibilityRole="button"
        >
          <Ionicons
            name="create-outline"
            size={30}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.noteButton}
          onPress={() => navigation.navigate('RecentNotes')}
          accessibilityLabel="Recent Notes"
          accessibilityRole="button"
        >
          <Ionicons name="time-outline" size={30} color={COLORS.PRIMARY_DARK} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.noteButton}
          onPress={() => navigation.navigate('BookmarkedNotes')}
          accessibilityLabel="Bookmarked Notes"
          accessibilityRole="button"
        >
          <Ionicons
            name="bookmark-outline"
            size={30}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.noteButton}
          onPress={() => navigation.navigate('ManageCategories')}
          accessibilityLabel="Manage Categories"
          accessibilityRole="button"
        >
          <Ionicons
            name="folder-open-outline"
            size={30}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
      </View>
      <HorizontalRule />

      <Grid>
        {core.categories.map((cat) => (
          <CardTopic
            key={cat}
            title={cat}
            icon={categoryIcons[cat] || 'folder-outline'}
            onPress={() =>
              navigation.navigate('NoteCategory', { category: cat })
            }
          />
        ))}
      </Grid>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  noteHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  noteButton: {
    paddingVertical: 6,
  },
});
