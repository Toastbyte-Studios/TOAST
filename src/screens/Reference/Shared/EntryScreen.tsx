import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { JSX, useEffect, useMemo, useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import referenceImages from '../../../assets/referenceImages';
import { HorizontalRule } from '../../../components/HorizontalRule';
import KnotStepCarousel from '../../../components/KnotStepCarousel';
import { Text } from '../../../components/ScaledText';
import ScreenBody from '../../../components/ScreenBody';
import SectionHeader from '../../../components/SectionHeader';
import {
  addBookmark,
  removeBookmark,
  isBookmarked,
} from '../../../stores/BookmarksStore';
import { COLORS, FOOTER_HEIGHT } from '../../../theme';
import ReferenceEntryType from '../../../types/data-type';

type EntryScreenRouteProp = RouteProp<
  { Entry: { entry: ReferenceEntryType } },
  'Entry'
>;

/**
 * EntryScreen displays detailed information about a specific reference entry,
 * including its summary, steps, cautions ("Do Not"), things to watch for, and notes.
 *
 * The screen also allows users to bookmark or un-bookmark the entry.
 *
 * - If the entry is not found, a "Topic Not Found" message is shown.
 * - The bookmark state is managed and persisted using async storage helpers.
 * - The entry data is received via navigation route parameters.
 * - If an image exists for the entry in the asset map, it is displayed at the top.
 *
 * @returns {JSX.Element} The rendered EntryScreen component.
 */
export default function EntryScreen(): JSX.Element {
  const route = useRoute<EntryScreenRouteProp>();
  const navigation = useNavigation();
  const { entry: routeEntry } = route.params || {};

  const resolvedEntry: ReferenceEntryType | null = useMemo(() => {
    if (routeEntry) return routeEntry as ReferenceEntryType;
    return null;
  }, [routeEntry]);

  const [bookmarked, setBookmarked] = useState<boolean>(false);

  useEffect(() => {
    const check = async () => {
      const entryId = resolvedEntry?.id;
      if (entryId) setBookmarked(await isBookmarked(entryId));
    };
    check();
  }, [resolvedEntry?.id]);

  /**
   * Toggles the bookmark state for the currently resolved entry.
   *
   * If there is no resolved entry, this function returns early without making changes.
   * When the entry is already bookmarked, it removes the bookmark and updates local state.
   * Otherwise, it adds a bookmark using the entry's id/title and the route category (or an empty string)
   * and updates local state.
   *
   * @remarks
   * This function performs asynchronous persistence operations and then synchronizes the `bookmarked`
   * React state accordingly.
   *
   * @returns A promise that resolves when the add/remove operation completes and local state is updated.
   */
  const toggleBookmark = async () => {
    if (!resolvedEntry) return;
    if (bookmarked) {
      await removeBookmark(resolvedEntry.id);
      setBookmarked(false);
    } else {
      await addBookmark({
        id: resolvedEntry.id,
        title: resolvedEntry.title,
        category: routeEntry?.category || '',
      });
      setBookmarked(true);
    }
  };

  if (!resolvedEntry) {
    return (
      <ScreenBody>
        <SectionHeader>Topic Not Found</SectionHeader>
        <View style={styles.missingWrap}>
          <Text style={styles.helperText}>
            No data available for this topic.
          </Text>
        </View>
      </ScreenBody>
    );
  }

  // Get the SVG component for this entry if it exists (single-image fallback)
  const SvgComponent =
    resolvedEntry.id &&
    (!resolvedEntry.images || resolvedEntry.images.length === 0)
      ? referenceImages[resolvedEntry.id]
      : null;

  return (
    <ScreenBody>
      <SectionHeader>{resolvedEntry.title}</SectionHeader>
      <View style={styles.actions}>
        <TouchableOpacity onPress={toggleBookmark} style={styles.actionBtn}>
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
      </View>
      <HorizontalRule />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Multi-step image carousel for knots */}
          {resolvedEntry.images && resolvedEntry.images.length > 0 ? (
            <KnotStepCarousel images={resolvedEntry.images} />
          ) : SvgComponent ? (
            /* Single reference image fallback */
            <View style={styles.imageCard}>
              <SvgComponent width="100%" height={200} />
            </View>
          ) : null}
          {/* Summary */}
          {!!resolvedEntry.summary && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Summary</Text>
              <Text style={styles.cardBody}>{resolvedEntry.summary}</Text>
            </View>
          )}
          {/* Steps */}
          {!!resolvedEntry.steps?.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Steps</Text>
              {resolvedEntry.steps.map((s: string, idx: number) => (
                <Text key={idx} style={styles.listItem}>{`• ${s}`}</Text>
              ))}
            </View>
          )}
          {/* Do Not */}
          {!!resolvedEntry.do_not?.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Do Not</Text>
              {resolvedEntry.do_not.map((s: string, idx: number) => (
                <Text key={idx} style={styles.listItem}>{`• ${s}`}</Text>
              ))}
            </View>
          )}
          {/* Watch For */}
          {!!resolvedEntry.watch_for?.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Watch For</Text>
              {resolvedEntry.watch_for.map((s: string, idx: number) => (
                <Text key={idx} style={styles.listItem}>{`• ${s}`}</Text>
              ))}
            </View>
          )}
          {/* Notes */}
          {!!resolvedEntry.notes?.length && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes</Text>
              {resolvedEntry.notes.map((s: string, idx: number) => (
                <Text key={idx} style={styles.listItem}>{`• ${s}`}</Text>
              ))}
            </View>
          )}
          {/* Related Screen Link */}
          {!!resolvedEntry.related_screen && (
            <TouchableOpacity
              style={styles.relatedScreenBtn}
              onPress={() => navigation.navigate(resolvedEntry.related_screen!)}
            >
              <Ionicons
                name="open-outline"
                size={18}
                color={COLORS.PRIMARY_DARK}
                style={styles.relatedScreenIcon}
              />
              <Text style={styles.relatedScreenLabel}>
                {resolvedEntry.related_screen_label ?? 'Open Reference Tool'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.PRIMARY_DARK}
              />
            </TouchableOpacity>
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
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: COLORS.TOAST_BROWN,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  missingWrap: {
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  helperText: {
    fontSize: 16,
    opacity: 0.8,
  },
  imageCard: {
    borderWidth: 1,
    borderColor: COLORS.TOAST_BROWN,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.TOAST_BROWN,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 20,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
  },
  relatedScreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.TOAST_BROWN,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  relatedScreenIcon: {
    marginRight: 8,
  },
  relatedScreenLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
