import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useTheme } from '../../hooks/useTheme';
import { useGestureNavigation } from '../../navigation/NavigationHistoryContext';
import {
  conversionCategories,
  ConversionUnit,
} from '../../utils/unitConversions';

type RouteParams = {
  ConversionCategory: {
    categoryId: string;
  };
};

// Formatting constants
const MIN_VALUE_FOR_EXPONENTIAL = 0.0001;
const EXPONENTIAL_SIGNIFICANT_DIGITS = 4;
const DECIMAL_PLACES = 6;

/**
 * ConversionCategoryScreen displays unit conversions for a specific category.
 *
 * Features:
 * - Dropdown to select conversion type within the category
 * - Two-way conversion display
 * - Large numeric keypad for easy input with gloves
 * - Real-time conversion as user types
 *
 * @returns A React element rendering the conversion interface.
 */
export default function ConversionCategoryScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ConversionCategory'>>();
  const { setDisableGestureNavigation } = useGestureNavigation();
  const COLORS = useTheme();
  const { categoryId } = route.params;

  const category = conversionCategories.find((cat) => cat.id === categoryId);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);
  const [inputValue, setInputValue] = useState('0');
  const [isReversed, setIsReversed] = useState(false);

  // Disable gesture navigation when this screen is focused
  useFocusEffect(
    useCallback(() => {
      setDisableGestureNavigation(true);
      return () => setDisableGestureNavigation(false);
    }, [setDisableGestureNavigation]),
  );

  if (!category) {
    return (
      <ScreenBody>
        <SectionHeader>Error</SectionHeader>
        <Text style={[styles.errorText, { color: COLORS.PRIMARY_DARK }]}>
          Category not found
        </Text>
      </ScreenBody>
    );
  }

  const selectedUnit: ConversionUnit = category.units[selectedUnitIndex];

  const handleNumberPress = (num: string) => {
    setInputValue((prev) => {
      // Handle leading zero - replace '0' with the number, but not '0.' or '-0'
      if (prev === '0' || prev === '-0') {
        return prev.startsWith('-') ? '-' + num : num;
      }
      return prev + num;
    });
  };

  const handleDecimalPress = () => {
    if (!inputValue.includes('.')) {
      setInputValue((prev) => prev + '.');
    }
  };

  const handleClear = () => {
    setInputValue('0');
  };

  const handleBackspace = () => {
    setInputValue((prev) => {
      if (prev.length === 1 || (prev.length === 2 && prev.startsWith('-'))) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  };

  const handleToggleSign = () => {
    setInputValue((prev) => {
      if (prev === '0') {
        return '0';
      }
      if (prev.startsWith('-')) {
        return prev.slice(1);
      }
      return '-' + prev;
    });
  };

  const handleSwap = () => {
    setIsReversed((prev) => !prev);
  };

  const getConvertedValue = (): string => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      return '0';
    }

    const result = isReversed
      ? selectedUnit.reverseConvert(numValue)
      : selectedUnit.convert(numValue);

    // Handle invalid results (Infinity, NaN)
    if (!isFinite(result)) {
      return 'Invalid';
    }

    // Format to significant digits, use exponential notation for very small numbers
    if (Math.abs(result) < MIN_VALUE_FOR_EXPONENTIAL && result !== 0) {
      return result.toExponential(EXPONENTIAL_SIGNIFICANT_DIGITS);
    }
    return result.toFixed(DECIMAL_PLACES).replace(/\.?0+$/, '');
  };

  const fromUnit = isReversed ? selectedUnit.toName : selectedUnit.fromName;
  const toUnit = isReversed ? selectedUnit.fromName : selectedUnit.toName;

  // Helper functions for inline styles
  const getValueContainerStyle = () => [
    styles.valueContainer,
    {
      borderColor: COLORS.SECONDARY_ACCENT,
      backgroundColor: COLORS.PRIMARY_LIGHT,
    },
  ];

  const getKeypadButtonStyle = () => [
    styles.keypadButton,
    {
      backgroundColor: COLORS.BRAND,
      borderColor: COLORS.SECONDARY_ACCENT,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: COLORS.BACKGROUND }]}>
      <LinearGradient
        colors={COLORS.BACKGROUND_GRADIENT}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <ScreenBody>
        <View style={styles.headerContainer}>
          <SectionHeader isShowHr={false}>{category.name}</SectionHeader>
        </View>

        {/* Unit Selection */}
        <View style={styles.unitSelectorContainer} pointerEvents="box-only">
          <ScrollView horizontal style={styles.unitSelector}>
            {category.units.map((unit, index) => (
              <TouchableOpacity
                key={unit.id}
                style={[
                  styles.unitButton,
                  {
                    backgroundColor:
                      selectedUnitIndex === index
                        ? COLORS.ACCENT
                        : COLORS.BRAND,
                    borderColor: COLORS.SECONDARY_ACCENT,
                  },
                ]}
                onPress={() => {
                  setSelectedUnitIndex(index);
                  setInputValue('0');
                  setIsReversed(false);
                }}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    {
                      color:
                        selectedUnitIndex === index
                          ? COLORS.PRIMARY_LIGHT
                          : COLORS.PRIMARY_DARK,
                    },
                  ]}
                >
                  {unit.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Conversion Display */}
        <View style={styles.conversionContainer}>
          <View style={getValueContainerStyle()}>
            <Text style={[styles.valueLabel, { color: COLORS.PRIMARY_DARK }]}>
              {fromUnit}
            </Text>
            <Text style={[styles.valueText, { color: COLORS.PRIMARY_DARK }]}>
              {inputValue}
            </Text>
          </View>

          <TouchableOpacity style={styles.swapButton} onPress={handleSwap}>
            <Ionicons
              name="swap-vertical-outline"
              size={32}
              color={COLORS.ACCENT}
            />
          </TouchableOpacity>

          <View style={getValueContainerStyle()}>
            <Text style={[styles.valueLabel, { color: COLORS.PRIMARY_DARK }]}>
              {toUnit}
            </Text>
            <Text style={[styles.valueText, { color: COLORS.PRIMARY_DARK }]}>
              {getConvertedValue()}
            </Text>
          </View>
        </View>

        {/* Numeric Keypad */}
        <View style={styles.keypad}>
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('7')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                7
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('8')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                8
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('9')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                9
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('4')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                4
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('5')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                5
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('6')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                6
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('1')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                1
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('2')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                2
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('3')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                3
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={handleToggleSign}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                +/−
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={() => handleNumberPress('0')}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                0
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={getKeypadButtonStyle()}
              onPress={handleDecimalPress}
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  { color: COLORS.PRIMARY_DARK },
                ]}
              >
                .
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[
                styles.keypadButton,
                styles.clearButton,
                {
                  backgroundColor: COLORS.ACCENT,
                  borderColor: COLORS.SECONDARY_ACCENT,
                },
              ]}
              onPress={handleClear}
            >
              <Text
                style={[
                  styles.clearButtonText,
                  { color: COLORS.PRIMARY_LIGHT },
                ]}
              >
                Clear
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.keypadButton,
                styles.backspaceButton,
                {
                  backgroundColor: COLORS.SECONDARY_ACCENT,
                  borderColor: COLORS.SECONDARY_ACCENT,
                },
              ]}
              onPress={handleBackspace}
            >
              <Ionicons
                name="backspace-outline"
                size={28}
                color={COLORS.PRIMARY_LIGHT}
              />
            </TouchableOpacity>
          </View>
        </View>
      </ScreenBody>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  headerContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  unitSelectorContainer: {
    width: '100%',
  },
  unitSelector: {
    width: '100%',
    maxHeight: 50,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
  },
  unitButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  conversionContainer: {
    width: '90%',
    marginVertical: 5,
  },
  valueContainer: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 5,
    paddingHorizontal: 16,
    marginVertical: 2,
  },
  valueLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
    fontWeight: '600',
  },
  valueText: {
    fontSize: 28,
    fontWeight: '700',
  },
  swapButton: {
    alignSelf: 'center',
    padding: 8,
  },
  keypad: {
    width: '90%',
    marginTop: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 5,
  },
  keypadButton: {
    width: '30%',
    aspectRatio: 1.5,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '700',
  },
  clearButton: {
    width: '63%',
    aspectRatio: 3,
  },
  clearButtonText: {
    fontSize: 20,
    fontWeight: '700',
  },
  backspaceButton: {
    width: '32%',
  },
});
