import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, {
  PropsWithChildren,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
  Easing,
  Text,
} from 'react-native';
import Svg, { Circle, Defs, Mask, Rect as SvgRect } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useKeyboardStatus } from '../hooks/useKeyboardStatus';
import { useSunShadow } from '../hooks/useSunShadow';
import { useTheme } from '../hooks/useTheme';
import {
  useNavigationHistory,
  useGestureNavigation,
} from '../navigation/NavigationHistoryContext';
import canGoBack, { goBack } from '../navigation/navigationRef';
import { FOOTER_HEIGHT } from '../theme';
import Footer from './Footer/Footer';
import { HelpModal } from './HelpModal';
import { HorizontalRule } from './HorizontalRule';
import LogoHeader from './LogoHeader';
import ScreenContainer from './ScreenContainer';
import { SettingsModal } from './SettingsModal';
import TutorialModal from './TutorialModal';
import {
  SpotlightLayout,
  TutorialSpotlightContext,
  TutorialSpotlightTarget,
} from './TutorialSpotlightContext';

type Props = PropsWithChildren;

type AppShellNavigationProp = NativeStackNavigationProp<{
  Home: undefined;
}>;

const DATE_FORMAT = 'dddd, MMMM D, YYYY';
const TUTORIAL_STORAGE_KEY = 'hasSeenTutorial';

/**
 * Root layout wrapper for the app.
 *
 * Provides:
 * - A consistent shell layout with a persistent header (settings button + logo) and a content area.
 * - Global horizontal swipe navigation using a `PanResponder` attached to the outer container:
 *   - Right swipe triggers {@link goBack} when {@link canGoBack} is true.
 *   - Left swipe triggers `goForward` when forward navigation is available.
 *
 * Gesture behavior:
 * - Attempts to avoid interfering with vertical scrolling and taps by requiring a minimum horizontal
 *   movement and favoring horizontal intent over vertical (bias check against `dy`).
 * - On release, triggers navigation only on "confident" swipes using distance (`dx`), velocity (`vx`),
 *   and vertical displacement (`dy`) thresholds.
 *
 * @remarks
 * The settings button opens a modal overlay that allows users to configure app settings.
 *
 * @param props - Component props.
 * @param props.children - Screen content to render inside the shell.
 * @returns The composed app shell containing the header, content, and gesture handlers.
 */
export default function AppShell({ children }: Props) {
  const navigation = useNavigation<AppShellNavigationProp>();
  const navigationHistory = useNavigationHistory();
  const { disableGestureNavigation } = useGestureNavigation();
  const { isKeyboardVisible, keyboardHeight } = useKeyboardStatus();
  const translateYRef = useRef(new Animated.Value(0)).current;
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
  const [tutorialSpotlightTarget, setTutorialSpotlightTarget] = useState<
    TutorialSpotlightTarget | undefined
  >(undefined);
  const [spotlightLayout, setSpotlightLayout] =
    useState<SpotlightLayout | null>(null);
  const logoRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const gestureContainerRef = useRef<View>(null);
  const sectionHeaderRef = useRef<any>(null);
  const [currentDate, setCurrentDate] = useState(() =>
    dayjs().format(DATE_FORMAT),
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const COLORS = useTheme();
  const sunShadow = useSunShadow();

  const markTutorialComplete = () => {
    AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
      .catch(() => {
        // Ignore persistence failures so users are not blocked in the tutorial.
      })
      .finally(() => {
        setIsTutorialVisible(false);
      });
  };

  // Keep `currentDate` in sync with the calendar date by scheduling a timeout
  // to fire exactly at the next midnight. When the timeout runs, it updates
  // the formatted date and then reschedules itself for the following midnight.
  // The cleanup function clears any pending timeout when the component unmounts.
  useEffect(() => {
    const scheduleNextUpdate = () => {
      const now = dayjs();
      const tomorrow = now.add(1, 'day').startOf('day');
      const msUntilMidnight = tomorrow.diff(now);

      timeoutRef.current = setTimeout(() => {
        setCurrentDate(dayjs().format(DATE_FORMAT));
        scheduleNextUpdate();
      }, msUntilMidnight);
    };

    scheduleNextUpdate();

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(TUTORIAL_STORAGE_KEY)
      .then((value) => {
        if (isMounted && value === null) {
          setIsTutorialVisible(true);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    Animated.timing(translateYRef, {
      toValue: isKeyboardVisible ? -keyboardHeight : 0,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isKeyboardVisible, keyboardHeight, translateYRef]);

  useEffect(() => {
    setSpotlightLayout(null);
    const targetRef =
      tutorialSpotlightTarget === 'logo'
        ? logoRef.current
        : tutorialSpotlightTarget === 'sectionHeader'
          ? sectionHeaderRef.current
          : null;
    if (!targetRef) return;
    let cancelled = false;
    targetRef.measureInWindow(
      (ex: number, ey: number, ew: number, eh: number) => {
        gestureContainerRef.current?.measureInWindow(
          (cx: number, cy: number) => {
            if (!cancelled) {
              setSpotlightLayout({
                x: ex - cx,
                y: ey - cy,
                width: ew,
                height: eh,
              });
            }
          },
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tutorialSpotlightTarget]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
          // If gesture navigation is disabled, don't capture any gestures
          if (disableGestureNavigation) return false;

          // Capture a clear right-swipe anywhere in the shell.
          // Avoid interfering with vertical scrolling/taps.
          const { dx, dy } = gestureState;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          const wantsBack = dx > 0;
          const wantsForward = dx < 0;

          if (wantsBack && !canGoBack()) return false;
          if (wantsForward && !navigationHistory.canGoForward()) return false;
          if (!wantsBack && !wantsForward) return false;

          // Make it easier to start the gesture, but still bias against vertical scroll.
          if (absDx < 6) return false;
          if (absDx < absDy * 0.9) return false;
          return true;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const { dx, dy, vx } = gestureState;
          const absDy = Math.abs(dy);

          // Trigger back/forward on a confident horizontal swipe.
          if (dx > 35 && absDy < 60) {
            goBack();
            return;
          }
          if (dx > 25 && vx > 0.25 && absDy < 80) {
            goBack();
            return;
          }

          if (dx < -35 && absDy < 60) {
            navigationHistory.goForward();
            return;
          }
          if (dx < -25 && vx < -0.25 && absDy < 80) {
            navigationHistory.goForward();
          }
        },
      }),
    [navigationHistory, disableGestureNavigation],
  );
  const handleSpotlightTargetChange = useCallback(
    (target?: TutorialSpotlightTarget) => {
      setTutorialSpotlightTarget(target);
    },
    [],
  );

  return (
    <ScreenContainer>
      <TutorialSpotlightContext.Provider
        value={{
          target: tutorialSpotlightTarget,
          setSpotlightLayout,
          containerRef: gestureContainerRef,
          sectionHeaderRef,
        }}
      >
        <View
          ref={gestureContainerRef}
          style={styles.gestureContainer}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.shell,
              { transform: [{ translateY: translateYRef }] },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.dateAndHelpContainer}>
                <Text
                  style={[styles.dateText, { color: COLORS.PRIMARY_DARK }]}
                  accessibilityLabel={`Current date: ${currentDate}`}
                >
                  {currentDate}
                </Text>
                <TouchableOpacity
                  style={styles.helpButton}
                  onPress={() => setIsHelpVisible(true)}
                  accessibilityLabel="Help"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={32}
                    color={COLORS.PRIMARY_DARK}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => setIsSettingsVisible(true)}
                accessibilityLabel="Settings"
                accessibilityRole="button"
              >
                <Ionicons
                  name="settings-outline"
                  size={26}
                  color={COLORS.PRIMARY_DARK}
                />
              </TouchableOpacity>

              <TouchableOpacity
                ref={logoRef}
                onPress={() => {
                  navigation.navigate('Home');
                }}
                accessibilityLabel="Go to home screen"
                accessibilityRole="button"
              >
                <LogoHeader shadowStyle={sunShadow} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>{children}</View>
          </Animated.View>

          <View style={styles.bottomRule}>
            <HorizontalRule />
          </View>

          {isTutorialVisible && (
            <Svg
              width="100%"
              height="100%"
              pointerEvents="none"
              style={styles.tutorialBackdrop}
            >
              <Defs>
                <Mask id="backdropMask">
                  <SvgRect
                    x="-1000"
                    y="-1000"
                    width="5000"
                    height="5000"
                    fill="white"
                  />
                  {spotlightLayout && tutorialSpotlightTarget === 'logo' && (
                    <Circle
                      cx={spotlightLayout.x + spotlightLayout.width / 2}
                      cy={spotlightLayout.y + spotlightLayout.height / 2}
                      r={
                        Math.min(
                          spotlightLayout.width,
                          spotlightLayout.height,
                        ) / 2
                      }
                      fill="black"
                    />
                  )}
                  {spotlightLayout &&
                    tutorialSpotlightTarget === 'sectionHeader' && (
                      <SvgRect
                        x={spotlightLayout.x}
                        y={spotlightLayout.y}
                        width={spotlightLayout.width}
                        height={spotlightLayout.height}
                        rx={8}
                        ry={8}
                        fill="black"
                      />
                    )}
                </Mask>
              </Defs>
              <SvgRect
                x="-1000"
                y="-1000"
                width="5000"
                height="5000"
                fill="rgba(0,0,0,0.65)"
                mask="url(#backdropMask)"
              />
            </Svg>
          )}

          <View
            style={
              tutorialSpotlightTarget === 'footerButtons'
                ? styles.spotlightTarget
                : undefined
            }
          >
            <Footer />
          </View>

          <TutorialModal
            visible={isTutorialVisible}
            onComplete={markTutorialComplete}
            onSkip={markTutorialComplete}
            onSpotlightTargetChange={handleSpotlightTargetChange}
          />
        </View>
      </TutorialSpotlightContext.Provider>

      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />

      <HelpModal
        visible={isHelpVisible}
        onClose={() => setIsHelpVisible(false)}
        onLaunchTutorial={() => {
          setIsHelpVisible(false);
          setIsTutorialVisible(true);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gestureContainer: {
    flex: 1,
    width: '100%',
  },
  shell: {
    flex: 1,
    paddingTop: 0,
    paddingHorizontal: 0,
    alignItems: 'stretch',
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
  },
  dateAndHelpContainer: {
    position: 'absolute',
    top: 30,
    left: 10,
    zIndex: 10,
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  helpButton: {
    padding: 6,
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: 10,
    zIndex: 10,
    padding: 6,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: 2,
    alignItems: 'stretch',
  },
  bottomRule: {
    position: 'absolute',
    bottom: FOOTER_HEIGHT,
    width: '100%',
  },
  tutorialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  spotlightTarget: {
    position: 'relative',
    zIndex: 200,
    elevation: 200,
  },
});
