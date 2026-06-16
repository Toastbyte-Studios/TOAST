/**
 * Mock for @maplibre/maplibre-react-native
 */

import React from 'react';
import { View } from 'react-native';

/** v11 API: Map is the renamed MapView. */
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

/** Legacy alias kept for tests that still reference MapView. */
export const MapView = React.forwardRef<
  unknown,
  React.ComponentProps<typeof View>
>((props, _ref) => <View testID="maplibre-map-view" {...props} />);

MapView.displayName = 'MapView';

export const Camera = ({
  testID,
  ...props
}: {
  testID?: string;
  [key: string]: unknown;
}) => <View testID={testID ?? 'maplibre-camera'} {...(props as object)} />;

export const UserLocation = ({
  testID,
  ...props
}: {
  testID?: string;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'maplibre-user-location'} {...(props as object)} />
);

export const ShapeSource = ({
  testID,
  children,
  ...props
}: {
  testID?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'maplibre-shape-source'} {...(props as object)}>
    {children}
  </View>
);

export const LineLayer = ({
  testID,
  ...props
}: {
  testID?: string;
  [key: string]: unknown;
}) => <View testID={testID ?? 'maplibre-line-layer'} {...(props as object)} />;

export const FillLayer = ({
  testID,
  ...props
}: {
  testID?: string;
  [key: string]: unknown;
}) => <View testID={testID ?? 'maplibre-fill-layer'} {...(props as object)} />;

export const SymbolLayer = ({
  testID,
  ...props
}: {
  testID?: string;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'maplibre-symbol-layer'} {...(props as object)} />
);

export const PointAnnotation = ({
  testID,
  children,
  ...props
}: {
  testID?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'maplibre-point-annotation'} {...(props as object)}>
    {children}
  </View>
);

export const TransformRequestManager = {
  addHeader: jest.fn(),
};

export const MapLibreRN = {
  setAccessToken: jest.fn(),
};

export default MapLibreRN;
