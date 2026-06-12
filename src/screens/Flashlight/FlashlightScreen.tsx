import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, View, Switch } from 'react-native';
import { FlashlightModes } from '../../../constants';
import CardTopic from '../../components/CardTopic';
import Grid from '../../components/Grid';
import { Text } from '../../components/ScaledText';
import ScreenBody from '../../components/ScreenBody';
import SectionHeader from '../../components/SectionHeader';
import { useSignalingStore } from '../../stores/StoreContext';
import { COLORS } from '../../theme';
import { FlashlightModeType } from '../../types/common-types';

/**
 * Flashlight screen implementation that lets the user select a flashlight mode and adjust
 * mode-specific settings.
 *
 * @remarks
 * - Reads the current mode and settings from the signaling store.
 * - Updates flashlight mode via `core.setFlashlightMode`.
 * - Provides navigation to the Nightvision screen.
 * - Conditionally renders:
 *   - **Strobe controls**: frequency slider (1–15 Hz) bound to `core.strobeFrequencyHz` and `core.setStrobeFrequency`.
 *   - **SOS controls**: tone toggle switch bound to `core.sosWithTone` and `core.setSosWithTone`.
 * - Highlights the active mode card using `styles.activeCard`.
 *
 * @returns A React element rendering the flashlight mode grid and any applicable controls.
 */
const FlashlightScreenImpl = () => {
  const core = useSignalingStore();
  const navigation = useNavigation();
  const mode = core.flashlightMode;

  const selectMode = (next: FlashlightModeType[keyof FlashlightModeType]) => {
    core.setFlashlightMode(next);
  };

  const openNightvision = () => {
    // @ts-ignore - navigation types
    navigation.navigate('Nightvision');
  };

  return (
    <ScreenBody>
      <SectionHeader>Flashlight</SectionHeader>

      <Grid>
        <CardTopic
          title="Flashlight On"
          icon="flashlight-outline"
          onPress={() => selectMode(FlashlightModes.ON)}
          containerStyle={
            mode === FlashlightModes.ON ? styles.activeCard : undefined
          }
        />
        <CardTopic
          title="SOS"
          icon="alert-outline"
          onPress={() => selectMode(FlashlightModes.SOS)}
          containerStyle={
            mode === FlashlightModes.SOS ? styles.activeCard : undefined
          }
        />
        <CardTopic
          title="Strobe"
          icon="flash-outline"
          onPress={() => selectMode(FlashlightModes.STROBE)}
          containerStyle={
            mode === FlashlightModes.STROBE ? styles.activeCard : undefined
          }
        />
        <CardTopic
          title="Nightvision"
          icon="moon-outline"
          onPress={openNightvision}
        />
      </Grid>

      {mode === FlashlightModes.STROBE && (
        <View style={styles.controlsContainer}>
          <SectionHeader isShowHr={false}>
            Strobe Frequency {core.strobeFrequencyHz} Hz
          </SectionHeader>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={15}
            step={1}
            value={core.strobeFrequencyHz}
            onValueChange={(v: number) => core.setStrobeFrequency(v)}
            minimumTrackTintColor={COLORS.ACCENT}
            maximumTrackTintColor={COLORS.SECONDARY_ACCENT}
          />
        </View>
      )}

      {mode === FlashlightModes.SOS && (
        <View style={styles.controlsContainer}>
          <SectionHeader isShowHr={false}>
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionText}>SOS Tone</Text>
              <Switch
                value={core.sosWithTone}
                onValueChange={(v: boolean) => core.setSosWithTone(v)}
                trackColor={{
                  false: COLORS.SECONDARY_ACCENT,
                  true: COLORS.ACCENT,
                }}
                thumbColor={
                  core.sosWithTone ? COLORS.PRIMARY_LIGHT : COLORS.TOAST_BROWN
                }
                style={styles.switchContainer}
              />
            </View>
          </SectionHeader>
        </View>
      )}
    </ScreenBody>
  );
};

export default observer(FlashlightScreenImpl);

const styles = StyleSheet.create({
  activeCard: {
    borderColor: COLORS.ACCENT,
    borderWidth: 3,
  },
  controlsContainer: {
    width: '100%',
    paddingHorizontal: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sectionText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.PRIMARY_DARK,
  },
  switchContainer: {
    paddingHorizontal: 20,
  },
});
