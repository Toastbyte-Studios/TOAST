import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { COLORS } from '../../theme';

type ComingSoonParams = {
  title?: string;
  icon?: string;
  message?: string;
};

type Props = {
  route: { params?: ComingSoonParams };
};

/**
 * Displays a "Coming Soon" screen with customizable title, icon, and message.
 *
 * This screen is typically used to indicate that a feature is under construction or not yet available.
 * The title, icon, and message can be provided via navigation route parameters; otherwise, default values are used.
 *
 * @param route - The navigation route object containing optional `title`, `icon`, and `message` parameters.
 * @returns A React element rendering the "Coming Soon" UI.
 */
export default function ComingSoonScreen({ route }: Props) {
  const title = route?.params?.title ?? 'Coming Soon';
  const icon = route?.params?.icon ?? 'construct-outline';
  const message =
    route?.params?.message ?? 'This feature is under construction.';

  return (
    <ScreenBody>
      <SectionHeader>{title}</SectionHeader>
      <View style={styles.card}>
        <Ionicons
          name={icon}
          size={72}
          color={COLORS.PRIMARY_DARK}
          style={styles.icon}
        />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: COLORS.SECONDARY_ACCENT,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BRAND,
    paddingVertical: 40,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  icon: {
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.PRIMARY_DARK,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: COLORS.PRIMARY_DARK,
    textAlign: 'center',
  },
});
