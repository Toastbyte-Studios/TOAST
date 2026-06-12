import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { HorizontalRule } from '../../../components/HorizontalRule';
import { Text } from '../../../components/ScaledText';
import ScreenBody from '../../../components/ScreenBody';
import SectionHeader from '../../../components/SectionHeader';
import { useCoreStore } from '../../../stores';
import { Note } from '../../../stores/CoreStore';
import { COLORS, FOOTER_HEIGHT } from '../../../theme';
import { formatDateTime } from '../../../utils/timeFormat';
import { noteListSharedStyles as shared } from '../noteListStyles';

type NoteEntryRouteProp = RouteProp<{ NoteEntry: { note: Note } }, 'NoteEntry'>;

/**
 * Displays a single note in fully expanded state.
 *
 * This screen retrieves a note from the navigation route parameters and displays
 * it with its full title and body text. It includes bookmark and delete functionality
 * and navigation options.
 *
 * @returns {JSX.Element} The rendered note entry screen component.
 *
 * @remarks
 * - Receives `note` parameter from the route params
 * - Displays the note title as the section header
 * - Shows the full note text in expanded view
 * - Includes bookmark and delete buttons
 * - Voice logs should be accessed through the Voice Log feature instead
 */
export default observer(function NoteEntryScreen(): React.JSX.Element {
  const route = useRoute<NoteEntryRouteProp>();
  const navigation = useNavigation();
  const core = useCoreStore();
  const [isBookmarked, setIsBookmarked] = useState<boolean>(
    route.params?.note?.bookmarked ?? false,
  );

  const { note } = route.params || {};

  if (!note) {
    return (
      <ScreenBody>
        <SectionHeader>Note Not Found</SectionHeader>
        <View style={styles.container}>
          <Text style={shared.value}>
            The requested note could not be found.
          </Text>
        </View>
      </ScreenBody>
    );
  }

  const noteTitle = note.title || '(Untitled)';
  const noteText = note.text || '';
  const noteType = note.type || 'text';
  const sketchDataUri = note.sketchDataUri;

  const handleBookmarkPress = async () => {
    await core.toggleNoteBookmark(note.id);
    setIsBookmarked(!isBookmarked);
  };

  return (
    <ScreenBody>
      <SectionHeader>{noteTitle}</SectionHeader>
      <View style={styles.noteHeader}>
        <TouchableOpacity
          accessibilityLabel="Edit note"
          accessibilityRole="button"
          style={shared.noteButton}
          onPress={() => {
            navigation.navigate('EditNote', { note });
          }}
        >
          <Icon name="create-outline" size={30} color={COLORS.PRIMARY_DARK} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Bookmark note"
          accessibilityRole="button"
          style={shared.noteButton}
          onPress={handleBookmarkPress}
        >
          <Icon
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={30}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Delete note"
          accessibilityRole="button"
          style={shared.noteButton}
          onPress={() => {
            Alert.alert(
              'Delete Note',
              'Are you sure you want to delete this note?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await core.deleteNote(note.id);
                    navigation.goBack();
                  },
                },
              ],
            );
          }}
        >
          <Icon name="trash-outline" size={30} color={COLORS.PRIMARY_DARK} />
        </TouchableOpacity>
      </View>
      <HorizontalRule />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={shared.actionsRow}>
            <Text style={shared.itemMeta}>
              {formatDateTime(new Date(note.createdAt))} • {note.category}
            </Text>
          </View>

          {noteType === 'text' ? (
            <View>
              <Text style={shared.itemBodyExpanded}>{noteText}</Text>
            </View>
          ) : noteType === 'sketch' && sketchDataUri ? (
            <View style={styles.sketchView}>
              <Image
                source={{ uri: sketchDataUri }}
                style={styles.sketchImage}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View>
              <Text style={shared.itemBodyExpanded}>
                No sketch data available.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenBody>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderWidth: 2,
    borderRadius: 12,
    borderColor: COLORS.SECONDARY_ACCENT,
    alignSelf: 'stretch',
    marginTop: 12,
    marginBottom: FOOTER_HEIGHT + 12,
  },
  noteHeader: {
    width: '75%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sketchView: {
    width: '100%',
    minHeight: 200,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sketchImage: {
    width: '100%',
    height: 300,
  },
});
