import { observer } from 'mobx-react-lite';
import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { useSettingsStore } from '../stores';

/**
 * Custom Text component that automatically scales font size based on user settings.
 * This component wraps the React Native Text component and applies the font scale
 * from the SettingsStore to any fontSize styles.
 */
export const Text = observer((props: TextProps) => {
  const settingsStore = useSettingsStore();
  const { style, ...otherProps } = props;

  // Apply font scaling to any numeric fontSize in the style (supports objects and arrays)
  let scaledStyle: TextProps['style'] = style;
  if (style != null) {
    const scale = settingsStore.fontScale;

    const scaleFontInStyleObject = (styleObj: TextStyle | false | '') => {
      if (!styleObj || typeof styleObj !== 'object') {
        return styleObj;
      }
      if (typeof styleObj.fontSize === 'number') {
        return {
          ...styleObj,
          fontSize: styleObj.fontSize * scale,
        };
      }
      return styleObj;
    };

    if (Array.isArray(style)) {
      scaledStyle = style.map((item) => {
        // Preserve registered style IDs (numbers), nullish values, and nested arrays
        if (typeof item === 'number' || item == null || Array.isArray(item)) {
          return item;
        }
        return scaleFontInStyleObject(item as TextStyle | false | '');
      }) as TextProps['style'];
    } else if (typeof style === 'number') {
      // Registered style ID; cannot safely inspect or modify
      scaledStyle = style;
    } else {
      scaledStyle = scaleFontInStyleObject(style);
    }
  }

  return <RNText {...otherProps} style={scaledStyle} />;
});
