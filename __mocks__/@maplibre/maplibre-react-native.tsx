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
 * Supported props: mapStyle, compass, accessible, accessibilityLabel,
 * onDidFinishLoadingMap, onLongPress, style, testID, children.
 */
export const Map = ({
  children,
  testID,
  style,
}: {
  children?: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
  /** MapLibre tile style URL. */
  mapStyle?: string;
  compass?: boolean;
  accessible?: boolean;
  accessibilityLabel?: string;
  onDidFinishLoadingMap?: () => void;
  onLongPress?: (event: unknown) => void;
  [key: string]: unknown;
}) => (
  <View testID={testID ?? 'map-view'} style={style}>
    {children}
  </View>
);

export const Camera = React.forwardRef<
  CameraRef,
  { initialViewState?: object; [key: string]: unknown }
>((_props, ref) => {
  React.useImperativeHandle(ref, () => ({
    setStop: jest.fn().mockResolvedValue(undefined),
    jumpTo: jest.fn(),
    easeTo: jest.fn(),
  }));
  return null;
});
Camera.displayName = 'Camera';

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
