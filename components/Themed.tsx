// I provide themed Text and View components that follow the device light/dark colour scheme.
// Refs: https://docs.expo.dev/guides/color-schemes/ | https://reactnative.dev/docs/components-and-apis
import { Text as DefaultText, View as DefaultView } from 'react-native';

import Colors from '../constants/Colors';
import { useColorScheme } from './useColorScheme';
import React from 'react';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

// I return the theme colour for the current scheme, with optional light/dark overrides from props.
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  if (colorFromProps) return colorFromProps;
  return Colors[theme][colorName];
}

// I render text using the current theme text colour unless overridden by lightColor/darkColor.
export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

// I render a view using the current theme background colour unless overridden.
export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
