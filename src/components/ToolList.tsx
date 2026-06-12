import {
  NavigationProp,
  ParamListBase,
  useNavigation,
} from '@react-navigation/native';
import { JSX, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ToolType } from '../types/common-types';
import CardTopic from './CardTopic';
import Grid from './Grid';

type ToolListProps = {
  tools: ToolType[];
};

/**
 * Renders a scrollable grid of tool or feature cards that navigate to their respective screens.
 *
 * This component is generic and can be used across different modules (e.g., Core, Navigation, Reference, Communications).
 *
 * @param tools - An array of tool objects, each containing a `name`, `icon`, and `screen` property.
 *   - If the tool's `screen` is `'ComingSoon'`, the card navigates to the "ComingSoon" screen with the tool's name and icon as parameters.
 *   - Otherwise, the card navigates to the specified screen.
 * @returns A JSX element containing a scrollable grid of tool/feature cards.
 */
export default function ToolList({ tools }: ToolListProps): JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  // Sort tools alphabetically by name
  const sortedTools = useMemo(
    () => [...tools].sort((a, b) => a.name.localeCompare(b.name)),
    [tools],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Grid>
          {sortedTools.map((tool) => {
            if (tool.screen === 'ComingSoon') {
              return (
                <CardTopic
                  key={tool.id}
                  title={tool.name}
                  icon={tool.icon}
                  onPress={() =>
                    navigation.navigate('ComingSoon', {
                      title: tool.name,
                      icon: tool.icon,
                    })
                  }
                />
              );
            }

            return (
              <CardTopic
                key={tool.id}
                title={tool.name}
                icon={tool.icon}
                onPress={() => navigation.navigate(tool.screen)}
              />
            );
          })}
        </Grid>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingBottom: 100,
  },
  scrollView: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  scrollContent: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 24,
  },
});
