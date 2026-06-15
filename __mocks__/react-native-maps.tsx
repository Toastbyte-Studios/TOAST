/**
 * Mock for react-native-maps
 */

import React from 'react';
import { View } from 'react-native';

const MapView = React.forwardRef<
  { animateToRegion: jest.Mock },
  React.ComponentProps<typeof View>
>((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    animateToRegion: jest.fn(),
  }));
  return <View testID="map-view" {...props} />;
});

MapView.displayName = 'MapView';

export default MapView;

export const Marker = ({
  testID,
  children,
  ...props
}: {
  testID?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'map-marker'} {...(props as object)}>
    {children}
  </View>
);

export const Polyline = ({
  testID,
  ...props
}: {
  testID?: string;
  [key: string]: unknown;
}) => <View testID={testID ?? 'map-polyline'} {...(props as object)} />;

export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = 'google';
