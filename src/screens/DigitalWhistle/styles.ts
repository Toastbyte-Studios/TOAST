import { StyleSheet } from 'react-native';
import { ColorScheme } from '../../theme/colors';

/**
 * Creates styles for the DigitalWhistleScreen component.
 * @param COLORS - Theme colors from useTheme hook
 * @returns StyleSheet for the DigitalWhistleScreen
 */
export const createStyles = (COLORS: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      paddingHorizontal: 14,
      paddingTop: 10,
    },
    whistleSection: {
      marginBottom: 30,
    },
    whistleTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: COLORS.PRIMARY_DARK,
      marginBottom: 12,
      textAlign: 'center',
    },
    whistleDescription: {
      fontSize: 14,
      color: COLORS.PRIMARY_DARK,
      marginBottom: 16,
      textAlign: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    buttonFlex: {
      flex: 1,
    },
    separator: {
      height: 2,
      backgroundColor: COLORS.BRAND,
      marginVertical: 20,
      opacity: 0.3,
    },
  });
