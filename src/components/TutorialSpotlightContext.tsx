import React from 'react';
import { View } from 'react-native';

export type TutorialSpotlightTarget =
  | 'logo'
  | 'sectionHeader'
  | 'footerButtons';

export type SpotlightLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TutorialSpotlightContextValue = {
  target: TutorialSpotlightTarget | undefined;
  setSpotlightLayout: (layout: SpotlightLayout | null) => void;
  containerRef: { current: View | null };
  sectionHeaderRef: React.MutableRefObject<any>;
};

export const TutorialSpotlightContext =
  React.createContext<TutorialSpotlightContextValue>({
    target: undefined,
    setSpotlightLayout: () => {},
    containerRef: { current: null },
    sectionHeaderRef: { current: null },
  });
