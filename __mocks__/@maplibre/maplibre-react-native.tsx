/**
 * Mock for @maplibre/maplibre-react-native
 */

import React from 'react';
import { View } from 'react-native';

export const Map = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => (
  <View testID="maplibre-map" {...(props as object)}>
    {children}
  </View>
);

export const Camera = (_props: { [key: string]: unknown }) => null;

export const TransformRequestManager = {
  addHeader: jest.fn(),
};
