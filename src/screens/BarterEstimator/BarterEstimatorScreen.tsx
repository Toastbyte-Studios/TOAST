import { observer } from 'mobx-react-lite';
import React, { JSX } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import SectionSubHeader from '../../components/SectionSubHeader';
import { useTheme } from '../../hooks/useTheme';
import { useInventoryStore, usePantryStore } from '../../stores/StoreContext';
import { FOOTER_HEIGHT } from '../../theme';
import {
  BarterSummary,
  CategoryScore,
  SCARCITY_THRESHOLD,
  StockStatus,
  SURPLUS_THRESHOLD,
  computeBarter,
} from './barterEstimatorUtils';

const STATUS_ICON: Record<StockStatus, string> = {
  surplus: 'trending-up-outline',
  balanced: 'remove-outline',
  scarce: 'trending-down-outline',
};

const READINESS_LABEL: Record<BarterSummary['overallReadiness'], string> = {
  poor: 'Poor — nothing to offer',
  fair: 'Fair — limited trade power',
  good: 'Good — a few bargaining chips',
  excellent: 'Excellent — strong barter position',
};

const READINESS_ICON: Record<BarterSummary['overallReadiness'], string> = {
  poor: 'warning-outline',
  fair: 'alert-circle-outline',
  good: 'checkmark-circle-outline',
  excellent: 'star-outline',
};

function CategoryRow({
  item,
  styles,
  COLORS,
}: {
  item: CategoryScore;
  styles: ReturnType<typeof makeStyles>;
  COLORS: ReturnType<typeof useTheme>;
}) {
  const iconColor =
    item.status === 'surplus'
      ? COLORS.SUCCESS
      : item.status === 'scarce'
        ? COLORS.ERROR
        : COLORS.BRAND;

  return (
    <View style={styles.row}>
      <Ionicons
        name={STATUS_ICON[item.status]}
        size={18}
        color={iconColor}
        style={styles.rowIcon}
      />
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>
          {item.source === 'pantry' ? 'Pantry' : (item.category ?? 'Inventory')}{' '}
          · {item.itemCount} item{item.itemCount !== 1 ? 's' : ''}, qty{' '}
          {Math.round(item.totalQuantity)}
        </Text>
      </View>
      <Text style={[styles.rowStatus, { color: iconColor }]}>
        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
      </Text>
    </View>
  );
}

/**
 * BarterEstimatorScreen
 *
 * Analyzes the user's pantry and inventory to suggest what they have in
 * surplus (good to trade) and what they're short on (should seek in trade).
 * All values are estimates for entertainment purposes only.
 */
export default observer(function BarterEstimatorScreen(): JSX.Element {
  const COLORS = useTheme();
  const pantryStore = usePantryStore();
  const inventoryStore = useInventoryStore();

  // Computed directly during render — MobX observer tracks all accessed
  // observables (items, categories, quantities) and re-renders on any change.
  const summary = computeBarter(
    pantryStore.items,
    pantryStore.categories,
    inventoryStore.items,
    inventoryStore.categories,
  );

  const hasItems =
    pantryStore.items.length > 0 || inventoryStore.items.length > 0;

  const styles = makeStyles(COLORS);

  return (
    <ScreenBody>
      <SectionHeader>Barter Estimator</SectionHeader>

      <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          <SectionSubHeader>
            Trade values are rough estimates for entertainment only. Real barter
            depends on local scarcity, relationships, and circumstances.
          </SectionSubHeader>

          {!hasItems ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="cube-outline"
                size={36}
                color={COLORS.BRAND}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyText}>
                Add items to your Pantry and Inventory to see your barter
                profile.
              </Text>
            </View>
          ) : (
            <>
              {/* Overall readiness */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Barter Position</Text>
                <View style={styles.badgeRow}>
                  <Ionicons
                    name={READINESS_ICON[summary.overallReadiness]}
                    size={20}
                    color={COLORS.ACCENT}
                  />
                  <Text style={styles.badgeText}>
                    {READINESS_LABEL[summary.overallReadiness]}
                  </Text>
                </View>
              </View>

              {/* What to offer */}
              {summary.offerItems.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={18}
                      color={COLORS.SUCCESS}
                    />
                    <Text style={styles.cardTitleSuccess}>You can offer</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    You have surplus in these categories — good trade chips.
                  </Text>
                  {summary.offerItems.map((item) => (
                    <CategoryRow
                      key={`${item.source}-${item.name}-${item.category ?? ''}`}
                      item={item}
                      styles={styles}
                      COLORS={COLORS}
                    />
                  ))}
                </View>
              )}

              {/* What to seek */}
              {summary.wantItems.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={18}
                      color={COLORS.ERROR}
                    />
                    <Text style={styles.cardTitleError}>You should seek</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    These categories are thin — prioritize acquiring them.
                  </Text>
                  {summary.wantItems.map((item) => (
                    <CategoryRow
                      key={`${item.source}-${item.name}-${item.category ?? ''}`}
                      item={item}
                      styles={styles}
                      COLORS={COLORS}
                    />
                  ))}
                </View>
              )}

              {/* Full breakdown */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Full Breakdown</Text>
                <Text style={styles.cardSubtitle}>
                  All categories ranked by barter value.
                </Text>
                {summary.categories
                  .slice()
                  .sort((a, b) => b.rawScore - a.rawScore)
                  .map((item) => (
                    <CategoryRow
                      key={`${item.source}-${item.name}-${item.category ?? ''}`}
                      item={item}
                      styles={styles}
                      COLORS={COLORS}
                    />
                  ))}
              </View>

              {/* How scores work */}
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>How scores work</Text>
                <Text style={styles.infoText}>
                  Each item category earns a weighted score based on post-crisis
                  desirability. Dry goods and canned goods score high; frozen
                  items score low since freezers fail quickly without power.
                  Categories above {Math.round(SURPLUS_THRESHOLD * 100)}% of
                  your total score are surplus; categories below{' '}
                  {Math.round(SCARCITY_THRESHOLD * 100)}% are scarce.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </ScreenBody>
  );
});

function makeStyles(COLORS: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scrollWrapper: {
      flex: 1,
      width: '100%',
      paddingBottom: FOOTER_HEIGHT,
    },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 24, gap: 16 },
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: COLORS.PRIMARY_LIGHT,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.BRAND + '40',
    },
    emptyIcon: { marginBottom: 8 },
    emptyText: {
      fontSize: 14,
      color: COLORS.PRIMARY_DARK,
      opacity: 0.65,
      textAlign: 'center',
      lineHeight: 20,
    },
    card: {
      backgroundColor: COLORS.PRIMARY_LIGHT,
      borderRadius: 12,
      padding: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: COLORS.BRAND + '40',
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.PRIMARY_DARK,
    },
    cardTitleSuccess: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.SUCCESS,
    },
    cardTitleError: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.ERROR,
    },
    cardSubtitle: {
      fontSize: 13,
      color: COLORS.PRIMARY_DARK,
      opacity: 0.65,
      lineHeight: 18,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    badgeText: {
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.ACCENT,
    },
    infoBox: {
      backgroundColor: COLORS.BACKGROUND,
      borderRadius: 10,
      padding: 14,
      gap: 6,
    },
    infoTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.PRIMARY_DARK,
    },
    infoText: {
      fontSize: 12,
      color: COLORS.PRIMARY_DARK,
      opacity: 0.7,
      lineHeight: 18,
    },
    // Row styles (shared for CategoryRow components)
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.BRAND + '25',
    },
    rowIcon: { marginRight: 10 },
    rowMain: { flex: 1 },
    rowName: {
      fontSize: 14,
      fontWeight: '500',
      color: COLORS.PRIMARY_DARK,
    },
    rowMeta: {
      fontSize: 12,
      color: COLORS.PRIMARY_DARK,
      opacity: 0.6,
      marginTop: 2,
    },
    rowStatus: { fontSize: 13, fontWeight: '600' },
  });
}
