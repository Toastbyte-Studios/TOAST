import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, TextProps, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import { SPACING } from '../theme';
import { LIGHT_COLORS } from '../theme/colors';
import { HorizontalRule } from './HorizontalRule';
import { Text } from './ScaledText';
import { TutorialSpotlightContext } from './TutorialSpotlightContext';

type Props = TextProps & {
  title?: string;
  isShowHr?: boolean;
  enableSearch?: boolean;
};

type SectionHeaderNavigationProp = NativeStackNavigationProp<{
  Search: undefined;
}>;

/**
 * Renders a section header using a `Text` component.
 *
 * Displays either the provided `title` prop or the `children` as the header content.
 * Additional styles can be applied via the `style` prop, and other props are spread onto the `Text` component.
 *
 * @param title - The text to display as the section header. If not provided, `children` will be used.
 * @param children - Alternative content to display if `title` is not specified.
 * @param style - Custom styles to apply to the header.
 * @param isShowHr - Whether to show the horizontal rule below the header. Default is true.
 * @param enableSearch - Whether clicking the header opens the search screen. Default is true.
 * @param rest - Additional props to pass to the `Text` component.
 */
export default function SectionHeader({
  title,
  children,
  style,
  isShowHr = true,
  enableSearch = true,
  ...rest
}: Props) {
  const navigation = useNavigation<SectionHeaderNavigationProp>();
  const COLORS = useTheme();
  const { sectionHeaderRef } = React.useContext(TutorialSpotlightContext);

  const handlePress = () => {
    navigation.navigate('Search');
  };

  const header = (
    <Text
      {...rest}
      numberOfLines={
        enableSearch ? (rest.numberOfLines ?? 1) : rest.numberOfLines
      }
      style={[
        styles.header,
        enableSearch && styles.headerWithSearch,
        {
          color: LIGHT_COLORS.PRIMARY_DARK,
          backgroundColor: COLORS.SECONDARY_ACCENT,
          borderColor: COLORS.TOAST_BROWN,
        },
        style,
      ]}
    >
      {title ?? children}
    </Text>
  );

  return (
    <>
      {enableSearch ? (
        <TouchableOpacity
          ref={sectionHeaderRef}
          onPress={handlePress}
          activeOpacity={0.7}
          style={styles.searchBar}
          accessibilityRole="button"
          accessibilityLabel="Search"
          accessibilityHint="Double tap to open search screen"
        >
          <View style={styles.headerRow}>
            {header}
            <Ionicons
              name="search-outline"
              size={16}
              color={LIGHT_COLORS.PRIMARY_DARK}
              style={styles.searchIcon}
              accessible={false}
            />
          </View>
        </TouchableOpacity>
      ) : (
        <View ref={sectionHeaderRef}>{header}</View>
      )}
      {isShowHr && <HorizontalRule />}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 20,
    fontFamily: 'Bitter-Bold',
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    width: '100%',
    textAlign: 'center',
    alignSelf: 'center',
    marginVertical: SPACING.md,
  },
  searchBar: {
    width: '80%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    right: SPACING.md,
    opacity: 0.6,
  },
  headerWithSearch: {
    paddingHorizontal: 40,
  },
});
