import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import {
  AstronomyEvent,
  AstronomyEventType,
} from '../../stores/AstronomyEventStore';
import {
  useAstronomyEventStore,
  useCoreStore,
} from '../../stores/StoreContext';
import { FOOTER_HEIGHT } from '../../theme';
import { formatDaysUntil } from '../../utils/formatDaysUntil';

const EVENT_TYPE_DETAILS: Record<
  AstronomyEventType,
  { color: string; description: string }
> = {
  solar_eclipse: {
    color: '#FF6B35',
    description: 'Eclipse',
  },
  lunar_eclipse: {
    color: '#9B59B6',
    description: 'Eclipse',
  },
  solstice: {
    color: '#F39C12',
    description: 'Solstice',
  },
  equinox: {
    color: '#27AE60',
    description: 'Equinox',
  },
  supermoon: {
    color: '#3498DB',
    description: 'Supermoon',
  },
  planet_rise: {
    color: '#1ABC9C',
    description: 'Planet',
  },
};

const formatEventDate = (date: Date): string => {
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface EventCardProps {
  event: AstronomyEvent;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const COLORS = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const typeInfo = EVENT_TYPE_DETAILS[event.type] ?? {
    color: COLORS.ACCENT,
    description: event.type,
  };
  const daysUntil = formatDaysUntil(event.date);
  const isImminent = event.date.getTime() - Date.now() < 7 * 24 * 3600 * 1000;

  const cardBorderStyle = {
    borderColor: isImminent ? typeInfo.color : COLORS.SECONDARY_ACCENT,
  };
  const badgeStyle = { backgroundColor: typeInfo.color };
  const daysUntilStyle = {
    color: isImminent ? typeInfo.color : COLORS.PRIMARY_DARK,
    fontWeight: (isImminent ? '700' : '500') as '700' | '500',
  };

  return (
    <View style={[styles.eventCard, cardBorderStyle]}>
      <LinearGradient
        colors={COLORS.BRAND_GRADIENT}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardBackground}
      />
      <View style={styles.cardRow}>
        <Text style={styles.eventIcon}>{event.icon}</Text>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.eventLabel}>{event.label}</Text>
            <View style={[styles.typeBadge, badgeStyle]}>
              <Text style={styles.typeBadgeText}>{typeInfo.description}</Text>
            </View>
          </View>
          <Text style={styles.eventDate}>{formatEventDate(event.date)}</Text>
          <Text style={[styles.daysUntil, daysUntilStyle]}>{daysUntil}</Text>
          <View style={styles.detailDivider} />
          <Text style={styles.eventDetail}>{event.detail}</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * SkyEventsScreen displays upcoming astronomical events in chronological
 * order for the next 12 months, including eclipses, solstices, equinoxes,
 * supermoons, and planet rise times.
 *
 * All calculations run fully offline using the `astronomia` library.
 *
 * @returns A React element containing the Sky Events screen UI.
 */
function SkyEventsScreen() {
  const COLORS = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const core = useCoreStore();
  const astronomyStore = useAstronomyEventStore();

  // Trigger event computation when location becomes available
  useEffect(() => {
    if (core.lastFix) {
      const { latitude, longitude } = core.lastFix.coords;
      astronomyStore.computeEvents(latitude, longitude);
    } else {
      // Compute without location (planet rise times will be skipped)
      astronomyStore.computeEventsWithoutLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.lastFix]);

  const upcomingEvents = astronomyStore.getUpcomingEvents(12);
  const hasLocation = !!core.lastFix;

  return (
    <ScreenBody>
      <SectionHeader>Sky Events</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {!hasLocation && (
            <View style={styles.locationBanner}>
              <LinearGradient
                colors={COLORS.BRAND_GRADIENT}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBackground}
              />
              <Text style={styles.locationBannerText}>
                📍 Enable location for planet rise times
              </Text>
            </View>
          )}

          {upcomingEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No upcoming sky events found in the next 12 months.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.subheader}>
                {upcomingEvents.length} event
                {upcomingEvents.length !== 1 ? 's' : ''} in the next 12 months
              </Text>
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenBody>
  );
}

export default observer(SkyEventsScreen);

const createStyles = (COLORS: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
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
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 24,
    },
    subheader: {
      fontSize: 14,
      fontWeight: '500',
      opacity: 0.7,
      marginBottom: 12,
      width: '80%',
      color: COLORS.PRIMARY_DARK,
    },
    locationBanner: {
      width: '80%',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.SECONDARY_ACCENT,
      padding: 12,
      marginBottom: 12,
      overflow: 'hidden',
    },
    locationBannerText: {
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      color: COLORS.PRIMARY_DARK,
    },
    eventCard: {
      width: '80%',
      borderRadius: 12,
      borderWidth: 2,
      paddingTop: 18,
      paddingBottom: 14,
      paddingHorizontal: 14,
      marginTop: 10,
      overflow: 'hidden',
    },
    cardBackground: {
      ...StyleSheet.absoluteFill,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    eventIcon: {
      fontSize: 32,
      marginRight: 12,
      textAlignVertical: 'center',
    },
    cardContent: {
      flex: 1,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 6,
    },
    eventLabel: {
      fontSize: 15,
      fontWeight: 'bold',
      flex: 1,
      color: COLORS.PRIMARY_DARK,
    },
    typeBadge: {
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: '#FFFFFF',
    },
    eventDate: {
      fontSize: 13,
      marginTop: 4,
      opacity: 0.85,
      color: COLORS.PRIMARY_DARK,
    },
    daysUntil: {
      fontSize: 12,
      marginTop: 2,
      opacity: 0.9,
    },
    detailDivider: {
      marginTop: 10,
      marginBottom: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(0,0,0,0.15)',
    },
    eventDetail: {
      fontSize: 13,
      lineHeight: 18,
      opacity: 0.85,
      color: COLORS.PRIMARY_DARK,
    },
    emptyState: {
      marginTop: 40,
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    emptyStateText: {
      fontSize: 14,
      textAlign: 'center',
      opacity: 0.7,
      color: COLORS.PRIMARY_DARK,
    },
  });
