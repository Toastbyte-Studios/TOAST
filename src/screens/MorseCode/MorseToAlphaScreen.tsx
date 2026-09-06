import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { COLORS, FOOTER_HEIGHT } from '../../theme';
import { morseToText } from '../../utils/morseCodeMapping';

/**
 * Morse to Alpha screen allows users to input morse code and see real-time translation.
 *
 * Features:
 * - Buttons for dot, dash, space (character separator), word separator (/), backspace, and clear
 * - Real-time translation as user types
 * - No submit button - translation happens automatically
 * - Shows both morse code input and translated text output
 */
const MorseToAlphaScreen = () => {
  const [morseInput, setMorseInput] = useState('');

  // Compute translation directly from morse input
  const translatedText = morseToText(morseInput);

  const handleDot = () => {
    setMorseInput((prev) => prev + '.');
  };

  const handleDash = () => {
    setMorseInput((prev) => prev + '-');
  };

  const handleSpace = () => {
    // Add space between morse characters
    if (morseInput.length > 0 && morseInput[morseInput.length - 1] !== ' ') {
      setMorseInput((prev) => prev + ' ');
    }
  };

  const handleWordSeparator = () => {
    // Add word separator (/) with spaces around it
    // Prevent adding consecutive word separators
    if (morseInput.length > 0) {
      const trimmed = morseInput.trimEnd();
      // Check if the last non-space character is already a word separator
      if (trimmed.length > 0 && trimmed[trimmed.length - 1] !== '/') {
        const lastChar = morseInput[morseInput.length - 1];
        if (lastChar === ' ') {
          setMorseInput((prev) => prev + '/ ');
        } else {
          setMorseInput((prev) => prev + ' / ');
        }
      }
    }
  };

  const handleBackspace = () => {
    setMorseInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setMorseInput('');
  };

  return (
    <ScreenBody>
      <SectionHeader>Morse to Alpha</SectionHeader>

      <View style={styles.container}>
        {/* Morse Code Input Display */}
        <View style={styles.displayContainer}>
          <Text style={styles.displayLabel}>Morse Code:</Text>
          <View style={styles.displayBox}>
            <Text style={styles.displayText}>
              {morseInput || 'Enter morse code...'}
            </Text>
          </View>
        </View>

        {/* Translated Text Display */}
        <View style={styles.displayContainer}>
          <Text style={styles.displayLabel}>Translation:</Text>
          <View style={styles.displayBox}>
            <Text style={styles.translatedText}>{translatedText || '-'}</Text>
          </View>
        </View>

        {/* Input Buttons */}
        <View style={styles.buttonGrid}>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleDot}
              accessibilityLabel="Add dot"
            >
              <Text style={styles.primaryButtonText}>.</Text>
              <Text style={styles.buttonLabel}>DOT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleDash}
              accessibilityLabel="Add dash"
            >
              <Text style={styles.primaryButtonText}>-</Text>
              <Text style={styles.buttonLabel}>DASH</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleSpace}
              accessibilityLabel="Add space between characters"
            >
              <Text style={styles.secondaryButtonText}>⎵</Text>
              <Text style={styles.buttonLabel}>SPACE</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleWordSeparator}
              accessibilityLabel="Add word separator"
            >
              <Text style={styles.secondaryButtonText}>/</Text>
              <Text style={styles.buttonLabel}>WORD</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleBackspace}
              accessibilityLabel="Delete last character"
            >
              <Text style={styles.secondaryButtonText}>⌫</Text>
              <Text style={styles.buttonLabel}>BACK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClear}
              accessibilityLabel="Clear all input"
            >
              <Text style={styles.clearButtonText}>CLEAR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            Tip: Press SPACE between morse characters (letters/numbers) and WORD
            to separate words.
          </Text>
        </View>
      </View>
    </ScreenBody>
  );
};

export default MorseToAlphaScreen;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: FOOTER_HEIGHT + 10,
  },
  displayContainer: {
    width: '100%',
    marginBottom: 10,
  },
  displayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.PRIMARY_DARK,
    marginBottom: 5,
  },
  displayBox: {
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderWidth: 2,
    borderColor: COLORS.BRAND,
    borderRadius: 8,
    padding: 10,
    minHeight: 50,
    justifyContent: 'center',
  },
  displayText: {
    fontSize: 16,
    color: COLORS.PRIMARY_DARK,
    fontFamily: 'monospace',
  },
  translatedText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.ACCENT,
  },
  buttonGrid: {
    width: '100%',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.ACCENT,
    borderWidth: 2,
    borderColor: COLORS.BRAND,
  },
  primaryButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.PRIMARY_LIGHT,
  },
  secondaryButton: {
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderWidth: 2,
    borderColor: COLORS.BRAND,
  },
  secondaryButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.PRIMARY_DARK,
  },
  buttonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.PRIMARY_DARK,
    marginTop: 2,
  },
  clearButton: {
    backgroundColor: COLORS.BRAND,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.PRIMARY_LIGHT,
  },
  helpContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY_ACCENT,
  },
  helpText: {
    fontSize: 11,
    color: COLORS.SECONDARY_ACCENT,
    textAlign: 'center',
  },
});
