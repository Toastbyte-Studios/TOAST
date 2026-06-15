import React, { useRef } from 'react';
import {
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  View,
  ViewStyle,
  TextStyle,
  ColorValue,
  StyleProp,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import { SPACING } from '../theme';
import { LIGHT_COLORS } from '../theme/colors';
import { Text } from './ScaledText';

export type CardTopicProps = {
  title: string;
  icon: string; // icon name
  onPress?: () => void;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  IconComponent?: React.ComponentType<{
    name: string;
    size?: number;
    color?: ColorValue | number;
    style?: StyleProp<TextStyle>;
  }>;
};

/**
 * A card component that displays an icon and a title, with a bounce animation on press.
 *
 * @param title - The text to display as the card's title.
 * @param icon - The name of the Ionicons icon to display.
 * @param onPress - Optional callback function to execute when the card is pressed.
 * @param containerStyle - Optional style overrides for the card container.
 * @param titleStyle - Optional style overrides for the title text.
 *
 * The card animates with a bounce effect when pressed, and then triggers the `onPress` callback if provided.
 */
export default function CardTopic({
  title,
  icon,
  onPress,
  containerStyle,
  titleStyle,
  IconComponent = Ionicons,
}: CardTopicProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const COLORS = useTheme();

  const bounce = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 90,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onPress && onPress());
  };

  return (
    <TouchableWithoutFeedback onPress={bounce}>
      <View style={[styles.shadow, containerStyle]}>
        <Animated.View
          style={[styles.animatedWrapper, { transform: [{ scale }], opacity }]}
        >
          <View style={[styles.card, { borderColor: COLORS.SECONDARY_ACCENT }]}>
            <LinearGradient
              colors={COLORS.TOAST_BROWN_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.background}
            />
            <IconComponent
              name={icon}
              size={40}
              color={LIGHT_COLORS.PRIMARY_DARK}
              style={styles.icon}
            />
            <Text
              style={[
                styles.title,
                { color: LIGHT_COLORS.PRIMARY_DARK },
                titleStyle,
              ]}
            >
              {title}
            </Text>
          </View>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const CARD_BORDER_RADIUS = 14;

const styles = StyleSheet.create({
  shadow: {
    width: '100%',
    borderRadius: CARD_BORDER_RADIUS,
    marginBottom: SPACING.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  animatedWrapper: {
    width: '100%',
    borderRadius: CARD_BORDER_RADIUS,
  },
  card: {
    width: '100%',
    minHeight: 65,
    borderRadius: CARD_BORDER_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  background: {
    ...StyleSheet.absoluteFill,
  },
  icon: {
    marginRight: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Bitter-Bold',
    flex: 1,
  },
});
