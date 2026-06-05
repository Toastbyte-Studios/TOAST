import React from 'react';

export type TutorialSpotlightTarget =
  | 'logo'
  | 'sectionHeader'
  | 'footerButtons';

export const TutorialSpotlightContext = React.createContext<
  TutorialSpotlightTarget | undefined
>(undefined);
