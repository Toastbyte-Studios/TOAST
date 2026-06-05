import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  Text as RNText,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';

interface TutorialModalProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface TutorialStep {
  icon: string;
  title: string;
  description: string;
  calloutPosition: 'top' | 'center' | 'bottom';
  indicator?: {
    label: string;
    direction: 'up' | 'down';
  };
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: 'sparkles-outline',
    title: 'Welcome',
    description: "Welcome to TOAST. Here's a quick tour.",
    calloutPosition: 'center',
  },
  {
    icon: 'swap-horizontal-outline',
    title: 'Swipe to Navigate',
    description: 'Swipe left or right to move between sections and tools.',
    calloutPosition: 'center',
  },
  {
    icon: 'home-outline',
    title: 'Tap the Logo',
    description: 'Tap the TOAST logo any time to return to the home screen.',
    calloutPosition: 'top',
    indicator: {
      label: 'TOAST logo',
      direction: 'up',
    },
  },
  {
    icon: 'search-outline',
    title: 'Tap the Section Header',
    description: 'Tap the section header title to open search in that section.',
    calloutPosition: 'top',
    indicator: {
      label: 'Section header',
      direction: 'up',
    },
  },
  {
    icon: 'notifications-outline',
    title: 'Footer Buttons',
    description:
      'Use footer buttons for notifications and quick access to settings/help.',
    calloutPosition: 'bottom',
    indicator: {
      label: 'Footer controls',
      direction: 'down',
    },
  },
  {
    icon: 'layers-outline',
    title: 'Modules Overview',
    description:
      'TOAST is organized into modules like Reference, Tools, and Prepper.',
    calloutPosition: 'center',
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'Done',
    description: "You're all set. Tap below to get started.",
    calloutPosition: 'center',
  },
];

export default function TutorialModal({
  visible,
  onComplete,
  onSkip,
}: TutorialModalProps) {
  const COLORS = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const step = TUTORIAL_STEPS[currentStep];
  const calloutPositionStyle =
    step.calloutPosition === 'top'
      ? styles.calloutTop
      : step.calloutPosition === 'bottom'
        ? styles.calloutBottom
        : styles.calloutCenter;
  const indicatorIcon =
    step.indicator?.direction === 'up'
      ? 'arrow-up-circle-outline'
      : 'arrow-down-circle-outline';
  const showIndicatorAboveCard = step.indicator?.direction === 'up';

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
    }
  }, [visible]);

  const dots = useMemo(
    () =>
      TUTORIAL_STEPS.map((_, index) => (
        <View
          key={`tutorial-dot-${index}`}
          style={[
            styles.dot,
            index === currentStep ? styles.activeDot : styles.inactiveDot,
            {
              backgroundColor:
                index === currentStep
                  ? COLORS.SECONDARY_ACCENT
                  : COLORS.TOAST_BROWN,
            },
          ]}
        />
      )),
    [COLORS.SECONDARY_ACCENT, COLORS.TOAST_BROWN, currentStep],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onSkip}
    >
      <View style={[styles.overlay, calloutPositionStyle]}>
        <View style={styles.calloutContainer}>
          {step.indicator && showIndicatorAboveCard && (
            <View
              style={styles.indicatorWrapper}
              accessibilityLabel={`${step.indicator.label} indicator`}
            >
              <RNText
                style={[styles.indicatorText, { color: COLORS.PRIMARY_LIGHT }]}
              >
                {step.indicator.label}
              </RNText>
              <Ionicons
                name={indicatorIcon}
                size={22}
                color={COLORS.SECONDARY_ACCENT}
              />
            </View>
          )}
          <View
            style={[
              styles.card,
              {
                backgroundColor: COLORS.PRIMARY_LIGHT,
                borderColor: COLORS.TOAST_BROWN,
              },
            ]}
          >
            <View style={styles.skipRow}>
              <TouchableOpacity
                onPress={onSkip}
                accessibilityLabel="Skip tutorial"
                accessibilityRole="button"
              >
                <RNText
                  style={[styles.skipText, { color: COLORS.SECONDARY_ACCENT }]}
                >
                  Skip
                </RNText>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Ionicons
                name={step.icon}
                size={66}
                color={COLORS.PRIMARY_DARK}
              />
              <RNText style={[styles.title, { color: COLORS.PRIMARY_DARK }]}>
                {step.title}
              </RNText>
              <RNText
                style={[styles.description, { color: COLORS.PRIMARY_DARK }]}
                accessibilityLabel={step.description}
              >
                {step.description}
              </RNText>
            </View>

            <View style={styles.footer}>
              <RNText
                style={[styles.progressText, { color: COLORS.PRIMARY_DARK }]}
              >
                {currentStep + 1} / {TUTORIAL_STEPS.length}
              </RNText>
              <View style={styles.dots}>{dots}</View>
              <TouchableOpacity
                onPress={() => {
                  if (isLastStep) {
                    onComplete();
                    return;
                  }
                  setCurrentStep((prev) => prev + 1);
                }}
                style={[
                  styles.primaryButton,
                  { backgroundColor: COLORS.SECONDARY_ACCENT },
                ]}
                accessibilityLabel={
                  isLastStep ? 'Finish tutorial' : 'Next tutorial step'
                }
                accessibilityRole="button"
              >
                <RNText
                  style={[
                    styles.primaryButtonText,
                    { color: COLORS.PRIMARY_DARK },
                  ]}
                >
                  {isLastStep ? 'Done' : 'Next'}
                </RNText>
              </TouchableOpacity>
            </View>
          </View>
          {step.indicator && !showIndicatorAboveCard && (
            <View
              style={styles.indicatorWrapper}
              accessibilityLabel={`${step.indicator.label} indicator`}
            >
              <Ionicons
                name={indicatorIcon}
                size={22}
                color={COLORS.SECONDARY_ACCENT}
              />
              <RNText
                style={[styles.indicatorText, { color: COLORS.PRIMARY_LIGHT }]}
              >
                {step.indicator.label}
              </RNText>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  calloutTop: {
    justifyContent: 'flex-start',
  },
  calloutCenter: {
    justifyContent: 'center',
  },
  calloutBottom: {
    justifyContent: 'flex-end',
  },
  calloutContainer: {
    width: '100%',
    maxWidth: 560,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
    minHeight: 440,
  },
  indicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 8,
  },
  indicatorText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  skipRow: {
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeDot: {
    opacity: 1,
  },
  inactiveDot: {
    opacity: 0.35,
  },
  primaryButton: {
    minWidth: 132,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
});
