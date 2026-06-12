import {
  NavigationProp,
  ParamListBase,
  useRoute,
  useNavigation,
  RouteProp,
} from '@react-navigation/native';
import React, { JSX, useMemo } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import CardTopic from '../../../components/CardTopic';
import Grid from '../../../components/Grid';
import { Text } from '../../../components/ScaledText';
import ScreenBody from '../../../components/ScreenBody';
import SectionHeader from '../../../components/SectionHeader';
import SectionSubHeader from '../../../components/SectionSubHeader';
import { FOOTER_HEIGHT } from '../../../theme';
import ReferenceEntryType from '../../../types/data-type';

type CategoryScreenRouteProp = RouteProp<
  {
    Category: {
      title: string;
      data: ReferenceEntryType[];
      disclaimer?: string;
    };
  },
  'Category'
>;

/**
 * Displays a list of reference entries filtered by category.
 *
 * This screen retrieves the `title` and `data` from the navigation route parameters,
 * filters the entries to only those matching the selected category, and displays them in a grid layout.
 * If no entries are found for the category, a helper message is shown.
 *
 * @returns {JSX.Element} The rendered category screen component.
 *
 * @remarks
 * - Navigates to the 'Entry' screen when a topic card is pressed, passing the selected entry as a parameter.
 * - Expects `route.params` to contain `title` (category name) and `data` (ReferenceEntryType[]).
 */
export default function CategoryScreen(): JSX.Element {
  const route = useRoute<CategoryScreenRouteProp>();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { title, data, disclaimer } = route.params || {};

  const entries = useMemo(() => {
    return (data ?? []).filter((e: ReferenceEntryType) => e.category === title);
  }, [title, data]);

  return (
    <ScreenBody>
      <SectionHeader>{title}</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {entries.length === 0 && (
            <Text style={styles.helperText}>No topics found.</Text>
          )}
          {disclaimer ? (
            <SectionSubHeader>{disclaimer}</SectionSubHeader>
          ) : null}
          <Grid>
            {entries
              .slice()
              .sort((a: ReferenceEntryType, b: ReferenceEntryType) =>
                a.title.localeCompare(b.title),
              )
              .map((item: ReferenceEntryType) => (
                <CardTopic
                  key={item.id}
                  title={item.title}
                  icon="document-text-outline"
                  onPress={() => navigation.navigate('Entry', { entry: item })}
                />
              ))}
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
