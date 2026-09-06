import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { COLORS } from '../../theme';

export type TrainerLevel = 'easy' | 'medium' | 'hard';

/**
 * Morse Code Trainer main screen.
 * Allows users to select difficulty level:
 * - Easy: Single character recognition
 * - Medium: Word recognition
 * - Hard: Sentence recognition
 */
export default function MorseTrainerScreen() {
  const navigation = useNavigation();

  const handleLevelSelect = (level: TrainerLevel) => {
    // @ts-expect-error - Navigation params typing not fully defined
    navigation.navigate('MorseTrainerLevel', { level });
  };

  return (
    <ScreenBody>
      <SectionHeader>Morse Code Trainer</SectionHeader>

      <View style={styles.container}>
        <Text style={styles.description}>
          Practice your morse code recognition skills. Select a difficulty level
          to begin:
        </Text>

        <View style={styles.levelContainer}>
          <TouchableOpacity
            style={[styles.levelButton, styles.easyButton]}
            onPress={() => handleLevelSelect('easy')}
            accessibilityLabel="Easy level - single character"
          >
            <Text style={styles.levelTitle}>EASY</Text>
            <Text style={styles.levelDescription}>
              Single character recognition
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.levelButton, styles.mediumButton]}
            onPress={() => handleLevelSelect('medium')}
            accessibilityLabel="Medium level - word"
          >
            <Text style={styles.levelTitle}>MEDIUM</Text>
            <Text style={styles.levelDescription}>Word recognition</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.levelButton, styles.hardButton]}
            onPress={() => handleLevelSelect('hard')}
            accessibilityLabel="Hard level - sentence"
          >
            <Text style={styles.levelTitle}>HARD</Text>
            <Text style={styles.levelDescription}>Sentence recognition</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  description: {
    fontSize: 14,
    color: COLORS.PRIMARY_DARK,
    marginBottom: 20,
    textAlign: 'center',
  },
  levelContainer: {
    width: '100%',
    gap: 12,
  },
  levelButton: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BRAND,
    alignItems: 'center',
  },
  easyButton: {
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  mediumButton: {
    backgroundColor: COLORS.SECONDARY_ACCENT,
  },
  hardButton: {
    backgroundColor: COLORS.ACCENT,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.PRIMARY_DARK,
    marginBottom: 4,
  },
  levelDescription: {
    fontSize: 12,
    color: COLORS.PRIMARY_DARK,
  },
});
