import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import CardTopic from '../../components/CardTopic';
import Grid from '../../components/Grid';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { FOOTER_HEIGHT } from '../../theme';
import { conversionCategories } from '../../utils/unitConversions';

/**
 * UnitConversionScreen displays all available unit conversion categories.
 *
 * Users can select a category to navigate to the conversion screen for that category.
 * Categories include Length, Weight, Volume, Temperature, Area, Speed, Pressure,
 * Energy, Time, Compass/Angles, Fuel, and Light.
 *
 * @returns A React element rendering the unit conversion categories grid.
 */
export default function UnitConversionScreen() {
  const navigation = useNavigation();

  const openCategory = (categoryId: string) => {
    navigation.navigate('ConversionCategory', { categoryId });
  };

  return (
    <ScreenBody>
      <SectionHeader>Unit Conversion</SectionHeader>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.gridWrapper}>
          <Grid>
            {conversionCategories.map((category) => (
              <CardTopic
                key={category.id}
                title={category.name}
                icon={category.icon}
                onPress={() => openCategory(category.id)}
              />
            ))}
          </Grid>
        </View>
      </ScrollView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: FOOTER_HEIGHT,
  },
  contentContainer: {
    alignItems: 'center',
  },
  gridWrapper: {
    alignItems: 'center',
  },
});
