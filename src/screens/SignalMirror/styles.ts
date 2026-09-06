import { StyleSheet } from 'react-native';
import { ColorScheme } from '../../theme/colors';

/**
 * Creates styles for the Ground-to-Air Signals reference screen within the SignalMirror module.
 * @param COLORS - Theme colors from useTheme hook
 * @returns StyleSheet for the Ground-to-Air Signals reference screen
 */
export const createStyles = (COLORS: ColorScheme) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 30,
    },
    signalCard: {
      backgroundColor: COLORS.BACKGROUND,
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
      borderLeftWidth: 5,
      borderLeftColor: COLORS.ACCENT,
    },
    signalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 14,
    },
    signalSymbol: {
      fontSize: 40,
      fontWeight: '900',
      color: COLORS.ACCENT,
      minWidth: 56,
      textAlign: 'center',
    },
    signalMeaning: {
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.PRIMARY_DARK,
      flex: 1,
    },
    signalDetail: {
      fontSize: 13,
      color: COLORS.PRIMARY_DARK,
      marginTop: 4,
      opacity: 0.75,
      lineHeight: 18,
    },
    signalDetailLabel: {
      fontWeight: '700',
      opacity: 1,
    },
    sizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      gap: 6,
    },
    sizeText: {
      fontSize: 13,
      color: COLORS.PRIMARY_DARK,
      opacity: 0.75,
    },
    resizeIcon: {
      opacity: 0.6,
    },
    separator: {
      height: 1,
      backgroundColor: COLORS.BRAND,
      marginVertical: 16,
      opacity: 0.2,
    },
  });
