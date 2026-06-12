import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useSignalingStore } from '../../stores/StoreContext';
import { COLORS } from '../../theme';
import { textToMorse } from '../../utils/morseCodeMapping';

const MAX_CHARACTERS = 300;

/**
 * Alpha to Morse screen allows users to input text and transmit it as morse code.
 *
 * Features:
 * - Text input with 300 character limit
 * - Submit button to start morse code transmission
 * - Sound toggle (default on)
 * - Uses flashlight and optional sound to transmit morse code
 * - References SOS implementation for morse code transmission
 */
const AlphaToMorseScreenImpl = () => {
  const core = useSignalingStore();
  const [message, setMessage] = useState('');
  const [morseWithTone, setMorseWithTone] = useState(true);

  const handleMessageChange = (text: string) => {
    if (text.length <= MAX_CHARACTERS) {
      setMessage(text);
    }
  };

  const handleSubmit = () => {
    if (message.trim().length === 0) {
      return;
    }

    const morseCode = textToMorse(message);
    core.transmitMorseMessage(morseCode, morseWithTone);
  };

  const isTransmitting = core.isMorseTransmitting;
  const remainingChars = MAX_CHARACTERS - message.length;

  return (
    <ScreenBody>
      <SectionHeader>Alpha to Morse</SectionHeader>

      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your message..."
            placeholderTextColor={COLORS.SECONDARY_ACCENT}
            value={message}
            onChangeText={handleMessageChange}
            multiline
            maxLength={MAX_CHARACTERS}
            editable={!isTransmitting}
          />
          <Text style={styles.charCounter}>
            {remainingChars} characters remaining
          </Text>
        </View>

        <View style={styles.controlsContainer}>
          <View style={styles.soundToggleContainer}>
            <Text style={styles.controlLabel}>Sound</Text>
            <Switch
              value={morseWithTone}
              onValueChange={setMorseWithTone}
              trackColor={{
                false: COLORS.SECONDARY_ACCENT,
                true: COLORS.ACCENT,
              }}
              thumbColor={
                morseWithTone ? COLORS.PRIMARY_LIGHT : COLORS.TOAST_BROWN
              }
              disabled={isTransmitting}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (message.trim().length === 0 || isTransmitting) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={message.trim().length === 0 || isTransmitting}
        >
          <Text style={styles.submitButtonText}>
            {isTransmitting ? 'Transmitting...' : 'Submit'}
          </Text>
        </TouchableOpacity>

        {isTransmitting && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={() => core.stopMorseTransmission()}
          >
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenBody>
  );
};

export default observer(AlphaToMorseScreenImpl);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderWidth: 2,
    borderColor: COLORS.TOAST_BROWN,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.PRIMARY_DARK,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 14,
    color: COLORS.SECONDARY_ACCENT,
    marginTop: 8,
    textAlign: 'right',
  },
  controlsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  soundToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderWidth: 2,
    borderColor: COLORS.TOAST_BROWN,
    borderRadius: 12,
    padding: 16,
  },
  controlLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.PRIMARY_DARK,
  },
  submitButton: {
    backgroundColor: COLORS.ACCENT,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.SECONDARY_ACCENT,
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.PRIMARY_LIGHT,
  },
  stopButton: {
    backgroundColor: COLORS.TOAST_BROWN,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.PRIMARY_LIGHT,
  },
});
