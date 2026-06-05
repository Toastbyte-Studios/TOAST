import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { HelpModal } from '../src/components/HelpModal';
import TutorialModal from '../src/components/TutorialModal';

jest.mock('../src/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    TOAST_BROWN: '#C09A6B',
    PRIMARY_DARK: '#1F1F1F',
    PRIMARY_LIGHT: '#F2EDE4',
    SECONDARY_ACCENT: '#8DAA9D',
    BACKGROUND: '#D9C8B0',
  })),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

describe('Tutorial flow components', () => {
  test('TutorialModal advances through steps and completes', () => {
    const onComplete = jest.fn();
    const onSkip = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <TutorialModal visible onComplete={onComplete} onSkip={onSkip} />,
      );
    });

    for (let step = 0; step < 6; step += 1) {
      ReactTestRenderer.act(() => {
        tree.root
          .findByProps({ accessibilityLabel: 'Next tutorial step' })
          .props.onPress();
      });
    }

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Finish tutorial' })
        .props.onPress();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  test('TutorialModal spotlights guided UI targets and hides skip on done', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <TutorialModal visible onComplete={jest.fn()} onSkip={jest.fn()} />,
      );
    });

    expect(() =>
      tree.root.findByProps({ accessibilityLabel: 'logo spotlight' }),
    ).toThrow();

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Next tutorial step' })
        .props.onPress();
      tree.root
        .findByProps({ accessibilityLabel: 'Next tutorial step' })
        .props.onPress();
    });

    expect(
      tree.root.findByProps({ accessibilityLabel: 'logo spotlight' }),
    ).toBeTruthy();

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Next tutorial step' })
        .props.onPress();
    });

    expect(
      tree.root.findByProps({ accessibilityLabel: 'sectionHeader spotlight' }),
    ).toBeTruthy();

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Next tutorial step' })
        .props.onPress();
    });

    expect(
      tree.root.findByProps({ accessibilityLabel: 'footerButtons spotlight' }),
    ).toBeTruthy();

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Next tutorial step' })
        .props.onPress();
      tree.root
        .findByProps({ accessibilityLabel: 'Next tutorial step' })
        .props.onPress();
    });

    expect(() =>
      tree.root.findByProps({ accessibilityLabel: 'Skip tutorial' }),
    ).toThrow();
  });

  test('HelpModal launches tutorial from How to use section', () => {
    const onLaunchTutorial = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <HelpModal
          visible
          onClose={jest.fn()}
          onLaunchTutorial={onLaunchTutorial}
          onResetTutorial={jest.fn()}
        />,
      );
    });

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'How to use collapsed' })
        .props.onPress();
    });

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Replay tutorial now' })
        .props.onPress();
    });

    expect(
      tree.root.findByProps({
        children:
          'Replay runs the tutorial now. Reset clears first-run progress and starts it again.',
      }),
    ).toBeTruthy();

    expect(
      tree.root.findByProps({ accessibilityLabel: 'Reset tutorial progress' }),
    ).toBeTruthy();

    expect(onLaunchTutorial).toHaveBeenCalledTimes(1);
  });
});
