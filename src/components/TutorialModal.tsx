import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text as RNText,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks/useTheme';
import { TutorialSpotlightTarget } from './TutorialSpotlightContext';
import { FOOTER_HEIGHT } from '../theme/constants';

interface TutorialModalProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onSpotlightTargetChange?: (target?: TutorialSpotlightTarget) => void;
}

interface TutorialStep {
  icon: string;
  title: string;
  description: string;
  spotlightTarget?: TutorialSpotlightTarget;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: 'sparkles-outline',
    title: 'Welcome',
    description: "Welcome to TOAST. Here's a quick tour.",
  },
  {
    icon: 'swap-horizontal-outline',
    title: 'Swipe to Navigate',
    description: 'Swipe left or right to move between sections and tools.',
  },
  {
    icon: 'home-outline',
    title: 'Tap the Logo',
    description: 'Tap the TOAST logo any time to return to the home screen.',
    spotlightTarget: 'logo',
  },
  {
    icon: 'search-outline',
    title: 'Tap the Section Header',
    description: 'Tap the section header title to open search in that section.',
    spotlightTarget: 'sectionHeader',
  },
  {
    icon: 'notifications-outline',
    title: 'Footer Buttons',
    description:
      'Use footer buttons for notifications and quick access to settings/help.',
    spotlightTarget: 'footerButtons',
  },
  {
    icon: 'layers-outline',
    title: 'Modules Overview',
    description:
      'TOAST is organized into modules like Reference, Tools, and Prepper.',
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'Done',
    description: "You're all set. Tap below to get started.",
  },
];

const TUTORIAL_CARD_BOTTOM_GAP = 5;
const TUTORIAL_CARD_BOTTOM_OFFSET = FOOTER_HEIGHT + TUTORIAL_CARD_BOTTOM_GAP;

export default function TutorialModal({
  visible,
  onComplete,
  onSkip,
  onSpotlightTargetChange,
}: TutorialModalProps) {
  const COLORS = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const step = TUTORIAL_STEPS[currentStep];
  const spotlightTarget = step.spotlightTarget;

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
    }
  }, [visible]);

  useEffect(() => {
    onSpotlightTargetChange?.(visible ? spotlightTarget : undefined);
  }, [onSpotlightTargetChange, spotlightTarget, visible]);

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
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.cardContainer}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: COLORS.PRIMARY_LIGHT,
              borderColor: COLORS.TOAST_BROWN,
            },
          ]}
        >
          {!isLastStep && (
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
          )}

          <View style={styles.content}>
            <Ionicons name={step.icon} size={66} color={COLORS.PRIMARY_DARK} />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    // AppShell renders this inside a full-screen flex container, so
    // absolute fill correctly covers the active app viewport.
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    zIndex: 300,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 560,
    marginBottom: TUTORIAL_CARD_BOTTOM_OFFSET,
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
