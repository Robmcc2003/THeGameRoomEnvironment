/**
 * Themed Components
 * 
 * This file provides themed versions of React Native's Text and View components.
 * These components automatically adapt to light/dark mode based on the user's system preferences.
 * 
 * How it works:
 * - useColorScheme() detects if the device is in light or dark mode
 * - useThemeColor() selects the appropriate color based on the theme
 * - Themed Text and View components use these colors automatically
 * 
 * This allows the app to support both light and dark themes without manually
 * changing colors everywhere in the code.
 * 
 * References:
 * - Expo Color Schemes: https://docs.expo.dev/guides/color-schemes/
 * - React Native Components: https://reactnative.dev/docs/components-and-apis
 */

// Import React Native's default Text and View components
// We'll wrap these to add theme support
import { Text as DefaultText, View as DefaultView } from 'react-native';

// Import color constants and color scheme hook
import Colors from '../constants/Colors';
import { useColorScheme } from './useColorScheme';
import React from 'react';

/**
 * Theme Props Type
 * 
 * These props allow you to override the theme colors for specific components.
 * You can pass lightColor or darkColor to use custom colors instead of the default theme colors.
 */
type ThemeProps = {
  lightColor?: string; // Color to use in light mode (optional)
  darkColor?: string; // Color to use in dark mode (optional)
};

/**
 * Themed Text Props
 * 
 * This extends React Native's Text props with theme support.
 * You can use all normal Text props, plus lightColor and darkColor.
 */
export type TextProps = ThemeProps & DefaultText['props'];

/**
 * Themed View Props
 * 
 * This extends React Native's View props with theme support.
 * You can use all normal View props, plus lightColor and darkColor.
 */
export type ViewProps = ThemeProps & DefaultView['props'];

/**
 * Get Theme Color
 * 
 * This function selects the appropriate color based on the current theme.
 * It first checks if a custom color was provided via props, then falls back
 * to the default theme color from the Colors constant.
 * 
 * @param props - Object with optional light and dark color overrides
 * @param colorName - Name of the color to get from Colors (e.g., 'text', 'background')
 * @returns The color to use for the current theme
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  // Get the current theme (light or dark)
  // useColorScheme() returns 'light', 'dark', or null
  const theme = useColorScheme() ?? 'light';
  
  // Check if a custom color was provided for this theme
  const colorFromProps = props[theme];

  if (colorFromProps) {
    // Use the custom color if provided
    return colorFromProps;
  } else {
    // Otherwise, use the default color from Colors constant
    return Colors[theme][colorName];
  }
}

/**
 * Themed Text Component
 * 
 * This is a Text component that automatically uses the correct text color
 * based on the current theme (light or dark).
 * 
 * Usage:
 * <Text>This text will be the correct color for the theme</Text>
 * <Text lightColor="#000000" darkColor="#FFFFFF">Custom colors</Text>
 * 
 * @param props - Text props plus optional lightColor and darkColor
 */
export function Text(props: TextProps) {
  // Destructure props - separate theme colors from other props
  const { style, lightColor, darkColor, ...otherProps } = props;
  
  // Get the text color for the current theme
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  // Return the default Text component with themed color applied
  // We merge the color with any custom styles passed in
  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

/**
 * Themed View Component
 * 
 * This is a View component that automatically uses the correct background color
 * based on the current theme (light or dark).
 * 
 * Usage:
 * <View>This view will have the correct background color for the theme</View>
 * <View lightColor="#FFFFFF" darkColor="#000000">Custom colors</View>
 * 
 * @param props - View props plus optional lightColor and darkColor
 */
export function View(props: ViewProps) {
  // Destructure props - separate theme colors from other props
  const { style, lightColor, darkColor, ...otherProps } = props;
  
  // Get the background color for the current theme
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  // Return the default View component with themed background color applied
  // We merge the backgroundColor with any custom styles passed in
  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
