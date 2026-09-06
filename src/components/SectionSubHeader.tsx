import React from 'react';
import { StyleSheet, TextProps } from 'react-native';
import { COLORS } from '../theme';
import { Text } from './ScaledText';

type Props = TextProps & { title?: string };

/**
 * Renders a section sub header using a `Text` component.
 *
 * Displays either the provided `title` prop or the `children` as the header content.
 * Additional styles can be applied via the `style` prop, and other props are spread onto the `Text` component.
 *
 * @param title - The text to display as the section sub header. If not provided, `children` will be used.
 * @param children - Alternative content to display if `title` is not specified.
 * @param style - Custom styles to apply to the header.
 * @param rest - Additional props to pass to the `Text` component.
 */
export default function SectionSubHeader({
  title,
  children,
  style,
  ...rest
}: Props) {
  return (
    <Text {...rest} style={[styles.header, style]}>
      {title ?? children}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 14,
    fontFamily: 'Bitter-Bold',
    color: COLORS.PRIMARY_DARK,
    backgroundColor: COLORS.SECONDARY_ACCENT,
    borderWidth: 2,
    borderColor: COLORS.BRAND,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: 300,
    textAlign: 'center',
    alignSelf: 'center',
    marginVertical: 4,
  },
});
