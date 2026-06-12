import { useNavigation } from '@react-navigation/native';
import React, { JSX } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CategoryList from '../../components/CategoryList';
import { HorizontalRule } from '../../components/HorizontalRule';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import data from '../../data/scenarioCards.json';
import { useTheme } from '../../hooks/useTheme';

const categoryMap: Record<string, string> = {
  'Power & Infrastructure': 'Power & Infrastructure',
  'Natural Disasters': 'Natural Disasters',
  'Medical & Health': 'Medical & Health',
  'Urban Survival': 'Urban Survival',
  'Wilderness & Travel': 'Wilderness & Travel',
  'Psychological & Decision': 'Psychological & Decision',
  'Quick Thinking': 'Quick Thinking',
};

const scenarioCategories = [
  {
    title: 'Power & Infrastructure',
    icon: 'flash-off-outline',
    id: 'scenario_power',
    category: categoryMap['Power & Infrastructure'],
    data: data.entries,
  },
  {
    title: 'Natural Disasters',
    icon: 'thunderstorm-outline',
    id: 'scenario_disasters',
    category: categoryMap['Natural Disasters'],
    data: data.entries,
  },
  {
    title: 'Medical & Health',
    icon: 'medical-outline',
    id: 'scenario_medical',
    category: categoryMap['Medical & Health'],
    data: data.entries,
  },
  {
    title: 'Urban Survival',
    icon: 'business-outline',
    id: 'scenario_urban',
    category: categoryMap['Urban Survival'],
    data: data.entries,
  },
  {
    title: 'Wilderness & Travel',
    icon: 'navigate-outline',
    id: 'scenario_wilderness',
    category: categoryMap['Wilderness & Travel'],
    data: data.entries,
  },
  {
    title: 'Psychological & Decision',
    icon: 'people-outline',
    id: 'scenario_psychological',
    category: categoryMap['Psychological & Decision'],
    data: data.entries,
  },
  {
    title: 'Quick Thinking',
    icon: 'flash-outline',
    id: 'scenario_quick',
    category: categoryMap['Quick Thinking'],
    data: data.entries,
  },
];

/**
 * Displays the Scenario Cards screen, providing navigation to various emergency scenario categories.
 *
 * This screen presents a grid of topics including Power & Infrastructure, Natural Disasters,
 * Medical & Health, Urban Survival, Wilderness & Travel, Psychological & Decision, and Quick Thinking,
 * each represented by a CardTopic component. Selecting a topic navigates to the 'ScenarioCategory' screen
 * with the corresponding category data.
 *
 * Includes an action bar with a bookmark icon to access bookmarked scenarios.
 *
 * @returns {JSX.Element} The rendered ScenarioCardsScreen component.
 */
export default function ScenarioCardsScreen(): JSX.Element {
  const navigation = useNavigation();
  const disclaimer: string = data?.metadata?.disclaimer ?? '';
  const COLORS = useTheme();

  return (
    <ScreenBody>
      <SectionHeader>Scenario Cards</SectionHeader>
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('ScenarioBookmarks')}
          accessibilityLabel="Bookmarked Scenarios"
          accessibilityRole="button"
        >
          <Ionicons
            name="bookmark-outline"
            size={30}
            color={COLORS.PRIMARY_DARK}
          />
        </TouchableOpacity>
      </View>
      <HorizontalRule />
      <CategoryList
        disclaimer={disclaimer}
        categories={scenarioCategories}
        categoryScreen="ScenarioCategory"
      />
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  actionButton: {
    paddingVertical: 6,
  },
});
