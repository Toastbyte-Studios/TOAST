import React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { COLORS, FOOTER_HEIGHT } from '../../theme';

const natoPhoneticAlphabet = [
  { letter: 'A', code: 'Alpha' },
  { letter: 'B', code: 'Bravo' },
  { letter: 'C', code: 'Charlie' },
  { letter: 'D', code: 'Delta' },
  { letter: 'E', code: 'Echo' },
  { letter: 'F', code: 'Foxtrot' },
  { letter: 'G', code: 'Golf' },
  { letter: 'H', code: 'Hotel' },
  { letter: 'I', code: 'India' },
  { letter: 'J', code: 'Juliet' },
  { letter: 'K', code: 'Kilo' },
  { letter: 'L', code: 'Lima' },
  { letter: 'M', code: 'Mike' },
  { letter: 'N', code: 'November' },
  { letter: 'O', code: 'Oscar' },
  { letter: 'P', code: 'Papa' },
  { letter: 'Q', code: 'Quebec' },
  { letter: 'R', code: 'Romeo' },
  { letter: 'S', code: 'Sierra' },
  { letter: 'T', code: 'Tango' },
  { letter: 'U', code: 'Uniform' },
  { letter: 'V', code: 'Victor' },
  { letter: 'W', code: 'Whiskey' },
  { letter: 'X', code: 'X-ray' },
  { letter: 'Y', code: 'Yankee' },
  { letter: 'Z', code: 'Zulu' },
];

/**
 * Displays the NATO Phonetic Alphabet with all 26 letters and their corresponding codes.
 *
 * Each letter is shown with its NATO phonetic code word (e.g., A - Alpha, B - Bravo).
 * The content is scrollable to accommodate all entries and ensure visibility past the footer.
 *
 * @returns A React element containing the NATO Phonetic Alphabet screen.
 */
export default function NatoPhoneticScreen() {
  return (
    <ScreenBody>
      <SectionHeader>NATO Phonetic</SectionHeader>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {natoPhoneticAlphabet.map((item) => (
            <View key={item.letter} style={styles.card}>
              <Text style={styles.letter}>{item.letter}</Text>
              <Text style={styles.separator}>-</Text>
              <Text style={styles.code}>{item.code}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingBottom: FOOTER_HEIGHT,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BRAND,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  letter: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.PRIMARY_DARK,
    width: 40,
  },
  separator: {
    fontSize: 20,
    color: COLORS.PRIMARY_DARK,
    marginHorizontal: 8,
  },
  code: {
    fontSize: 20,
    color: COLORS.PRIMARY_DARK,
    flex: 1,
  },
});
