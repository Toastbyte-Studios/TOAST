/**
 * Mock for @maplibre/maplibre-react-native
 */

import React from 'react';
import { View, type ViewStyle } from 'react-native';

export type CameraRef = {
  setStop: (options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
    easing?: string;
  }) => Promise<void>;
  jumpTo: (options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
  }) => void;
  easeTo: (options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  }) => void;
};

/**
 * Minimal mock for the MapLibre Map component.
 * Supported props: mapStyle, compass, compassPosition, attribution,
 * attributionPosition, logo, accessible, accessibilityLabel,
 * onDidFinishLoadingMap, onLongPress, style, testID, children.
 */
export const Map = ({
  children,
  testID,
  style,
  ...props
}: {
  children?: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
  /** MapLibre tile style URL. */
  mapStyle?: string;
  compass?: boolean;
  compassPosition?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  attribution?: boolean;
  attributionPosition?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  logo?: boolean;
  accessible?: boolean;
  accessibilityLabel?: string;
  onDidFinishLoadingMap?: () => void;
  onLongPress?: (event: unknown) => void;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'map-view'} style={style} {...(props as object)}>
    {children}
  </View>
);

/** Legacy alias kept for tests that still reference MapView. */
export const MapView = React.forwardRef<
  unknown,
  React.ComponentProps<typeof View>
>((props, _ref) => <View testID="maplibre-map-view" {...props} />);

MapView.displayName = 'MapView';

export const Camera = React.forwardRef<
  CameraRef,
  {
    initialViewState?: object;
    trackUserLocation?: 'default' | 'heading' | 'course';
    testID?: string;
    [key: string]: unknown;
  }
>((_props, ref) => {
  React.useImperativeHandle(ref, () => ({
    setStop: jest.fn().mockResolvedValue(undefined),
    jumpTo: jest.fn(),
    easeTo: jest.fn(),
  }));
  return null;
});
Camera.displayName = 'Camera';

export const UserLocation = ({
  testID,
  ...props
}: {
  /** Show accuracy circle around the user dot. */
  accuracy?: boolean;
  testID?: string;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'maplibre-user-location'} {...(props as object)} />
);

export const Marker = ({
  children,
  testID,
}: {
  id?: string;
  lngLat: [number, number];
  testID?: string;
  children?: React.ReactNode;
}) => <View testID={testID ?? 'map-marker'}>{children}</View>;

export const GeoJSONSource = ({
  children,
}: {
  id?: string;
  data?: object | string;
  children?: React.ReactNode;
}) => <View>{children}</View>;

export const Layer = (_props: { id?: string; type?: string; style?: object }) =>
  null;

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

/**
 * LocationManager mock — provides unified permission request for iOS + Android.
 */
export const LocationManager = {
  requestPermissions: jest.fn().mockResolvedValue(true),
  start: jest.fn(),
  stop: jest.fn(),
};

/**
 * useCurrentPosition mock — returns a static San Francisco position by default.
 * Override per-test via `useCurrentPosition.mockReturnValue(...)` when different
 * coordinates are needed.
 */
export const useCurrentPosition = jest.fn(() => ({
  coords: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: null,
    accuracy: 5,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
}));
export const MapLibreRN = {
  setAccessToken: jest.fn(),
};

export default MapLibreRN;
