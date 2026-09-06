import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import constellationImages from '../../assets/constellationImages';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCoreStore } from '../../stores/StoreContext';
import { FOOTER_HEIGHT } from '../../theme';
import {
  ConstellationGuide,
  NavigationalStar,
  getCurrentSeason,
  getConstellationGuides,
  getHemisphere,
  getNavigationInstructions,
  getStarsForHemisphere,
} from '../../utils/starNavigation';

/**
 * StarMapScreen
 *
 * Offline Star Map & Celestial Navigation reference tool. Displays:
 * - Step-by-step instructions for finding north or south using stars
 * - Key navigational stars with their navigation significance
 * - Constellation guides relevant to the observer's hemisphere and current month
 *
 * Works entirely offline using the embedded star catalog. Uses the device
 * location from CoreStore to determine hemisphere and tailor the guide.
 *
 * @returns A React element containing the Star Map screen UI.
 */
function StarMapScreen() {
  const COLORS = useTheme();
  const core = useCoreStore();
  const [hemisphere, setHemisphere] = useState<'northern' | 'southern'>(
    'northern',
  );

  const now = new Date();
  const month = now.getUTCMonth() + 1;

  useEffect(() => {
    if (core.lastFix) {
      setHemisphere(getHemisphere(core.lastFix.coords.latitude));
    }
  }, [core.lastFix]);

  const season = getCurrentSeason(now, hemisphere);
  const instructions = useMemo(
    () => getNavigationInstructions(hemisphere, month),
    [hemisphere, month],
  );
  const stars = useMemo(() => getStarsForHemisphere(hemisphere), [hemisphere]);
  const constellations = useMemo(
    () => getConstellationGuides(hemisphere, month),
    [hemisphere, month],
  );

  const renderStepCard = (step: string, index: number) => (
    <View
      key={index}
      style={[styles.stepCard, { borderColor: COLORS.SECONDARY_ACCENT }]}
    >
      <LinearGradient
        colors={COLORS.BRAND_GRADIENT}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardBackground}
      />
      <Text style={[styles.stepText, { color: COLORS.PRIMARY_DARK }]}>
        {step}
      </Text>
    </View>
  );

  const renderStarCard = (star: NavigationalStar, index: number) => (
    <View
      key={index}
      style={[styles.starCard, { borderColor: COLORS.SECONDARY_ACCENT }]}
    >
      <LinearGradient
        colors={COLORS.BRAND_GRADIENT}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardBackground}
      />
      <View style={styles.starCardHeader}>
        <Text style={styles.starEmoji}>★</Text>
        <View style={styles.starCardTitles}>
          <Text style={[styles.starName, { color: COLORS.PRIMARY_DARK }]}>
            {star.name}
          </Text>
          <Text
            style={[styles.starConstellation, { color: COLORS.PRIMARY_DARK }]}
          >
            {star.constellation}
          </Text>
        </View>
      </View>
      <Text style={[styles.starSignificance, { color: COLORS.PRIMARY_DARK }]}>
        {star.significance}
      </Text>
    </View>
  );

  const renderConstellationCard = (
    guide: ConstellationGuide,
    index: number,
  ) => {
    const SvgDiagram = constellationImages[guide.imageKey];
    return (
      <View
        key={index}
        style={[
          styles.constellationCard,
          { borderColor: COLORS.SECONDARY_ACCENT },
        ]}
      >
        <LinearGradient
          colors={COLORS.BRAND_GRADIENT}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardBackground}
        />
        <Text
          style={[styles.constellationName, { color: COLORS.PRIMARY_DARK }]}
        >
          {guide.name}
        </Text>
        {SvgDiagram && (
          <View style={styles.diagramContainer}>
            <SvgDiagram width="100%" height={180} />
          </View>
        )}
        <Text style={[styles.guideLabel, { color: COLORS.PRIMARY_DARK }]}>
          How to find it
        </Text>
        <Text style={[styles.guideText, { color: COLORS.PRIMARY_DARK }]}>
          {guide.howToFind}
        </Text>
        <Text style={[styles.guideLabel, { color: COLORS.PRIMARY_DARK }]}>
          Navigation use
        </Text>
        <Text style={[styles.guideText, { color: COLORS.PRIMARY_DARK }]}>
          {guide.navigationUse}
        </Text>
      </View>
    );
  };

  return (
    <ScreenBody>
      <SectionHeader>Star Map & Celestial Navigation</SectionHeader>

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Context banner */}
          <View
            style={[
              styles.contextBanner,
              { borderColor: COLORS.SECONDARY_ACCENT },
            ]}
          >
            <LinearGradient
              colors={COLORS.BRAND_GRADIENT}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardBackground}
            />
            <Text style={[styles.contextText, { color: COLORS.PRIMARY_DARK }]}>
              🌍{' '}
              {hemisphere === 'northern'
                ? 'Northern Hemisphere'
                : 'Southern Hemisphere'}
              {'  '}·{'  '}
              {season}
            </Text>
            {!core.lastFix && (
              <Text
                style={[styles.contextNote, { color: COLORS.PRIMARY_DARK }]}
              >
                Enable location for hemisphere-specific guidance
              </Text>
            )}
          </View>

          {/* Navigation instructions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.PRIMARY_DARK }]}>
              Finding{' '}
              {hemisphere === 'northern'
                ? 'North with Polaris'
                : 'South with the Southern Cross'}
            </Text>
            {instructions.map((step, i) => renderStepCard(step, i))}
          </View>

          {/* Navigational stars */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.PRIMARY_DARK }]}>
              Key Navigational Stars
            </Text>
            {stars.map((star, i) => renderStarCard(star, i))}
          </View>

          {/* Constellation guides */}
          {constellations.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: COLORS.PRIMARY_DARK }]}
              >
                Constellations Visible Now
              </Text>
              {constellations.map((guide, i) =>
                renderConstellationCard(guide, i),
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenBody>
  );
}

export default observer(StarMapScreen);

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
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  section: {
    width: '90%',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  contextBanner: {
    width: '90%',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    overflow: 'hidden',
    alignItems: 'center',
    marginTop: 8,
  },
  contextText: {
    fontSize: 16,
    fontWeight: '700',
  },
  contextNote: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
    textAlign: 'center',
  },
  stepCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    overflow: 'hidden',
  },
  stepText: {
    fontSize: 14,
    lineHeight: 20,
  },
  starCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  starCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starEmoji: {
    fontSize: 28,
    marginRight: 12,
    color: '#FFD700',
  },
  starCardTitles: {
    flex: 1,
  },
  starName: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  starConstellation: {
    fontSize: 13,
    opacity: 0.75,
    marginTop: 2,
  },
  starSignificance: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
  },
  constellationCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  diagramContainer: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  constellationName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  guideLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.8,
    textTransform: 'uppercase',
  },
  guideText: {
    fontSize: 13,
    lineHeight: 19,
  },
  cardBackground: {
    ...StyleSheet.absoluteFill,
  },
});
