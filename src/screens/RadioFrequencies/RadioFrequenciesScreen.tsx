import { useNavigation } from '@react-navigation/native';
import React, { JSX } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import CardTopic from '../../components/CardTopic';
import Grid from '../../components/Grid';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import SectionSubHeader from '../../components/SectionSubHeader';
import radioFrequenciesData from '../../data/radioFrequencies.json';
import { FOOTER_HEIGHT } from '../../theme';

const radioCategories = [
  { id: 'HAM', title: 'HAM', icon: 'radio-outline' },
  { id: 'CB', title: 'CB', icon: 'chatbubbles-outline' },
  { id: 'GMRS', title: 'GMRS', icon: 'wifi-outline' },
  { id: 'FRS', title: 'FRS', icon: 'phone-portrait-outline' },
  { id: 'MURS', title: 'MURS', icon: 'headset-outline' },
];

/**
 * Displays radio frequency categories for different communication systems.
 *
 * Shows categories for HAM, CB, GMRS, FRS, and MURS radio frequencies as well
 * as a Local Repeaters entry (powered by RepeaterBook) in a grid layout using
 * standard cards. Content includes proper bottom padding to prevent overflow
 * into the footer.
 *
 * @component
 * @returns {JSX.Element} The rendered radio frequencies screen.
 */
export default function RadioFrequenciesScreen(): JSX.Element {
  const navigation = useNavigation();
  const disclaimer: string = radioFrequenciesData.metadata?.disclaimer ?? '';

  const handleCategoryPress = (categoryId: string) => {
    const frequencyData =
      radioFrequenciesData.frequencies[
        categoryId as keyof typeof radioFrequenciesData.frequencies
      ];

    if (frequencyData) {
      navigation.navigate('RadioFrequencyDetail', { frequencyData });
    }
  };

  return (
    <ScreenBody>
      <SectionHeader>Radio Frequencies</SectionHeader>

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {disclaimer.trim().length > 0 && (
            <SectionSubHeader>{disclaimer}</SectionSubHeader>
          )}
          <Grid>
            {radioCategories.map((category) => (
              <CardTopic
                key={category.id}
                title={category.title}
                icon={category.icon}
                onPress={() => handleCategoryPress(category.id)}
              />
            ))}
            <CardTopic
              title="Local Repeaters"
              icon="location-outline"
              onPress={() => navigation.navigate('RepeaterBook')}
            />
          </Grid>
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
});
