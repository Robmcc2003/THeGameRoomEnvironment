/**
 * Color Constants
 * 
 * This file defines the color palette for light and dark themes.
 * These colors are used by the Themed components (Themed.tsx) to automatically
 * adapt to light/dark mode based on the user's system preferences.
 * 
 * References:
 * - Color theory: https://en.wikipedia.org/wiki/Color_theory
 * - CSS Color Values: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
 */

// Tint color (accent color) - same for both themes
// This is the red color used for buttons, highlights, etc.
const tintColorLight = '#DC143C'; // Red (Crimson) for light theme
const tintColorDark = '#DC143C'; // Red (Crimson) for dark theme (same as light)

export default {
  light: {
    text: '#000000', // Black text on white background
    background: '#FFFFFF', // White background
    tint: tintColorLight, // Red accent color
    tabIconDefault: '#999999', // Dark gray for inactive tabs
    tabIconSelected: tintColorLight, // Red for active tab
    card: '#FFFFFF', // White card background
    border: '#000000', // Black border accents
  },
  dark: {
    text: '#FFFFFF', // White text on dark background
    background: '#1A1A1A', // Very dark (almost black) background
    tint: tintColorDark, // Red accent color (same as light)
    tabIconDefault: '#666666', // Medium gray for inactive tabs
    tabIconSelected: tintColorDark, // Red for active tab
    card: '#2A2A2A', // Dark gray card background
    border: '#000000', // Black border accents (same as light)
  },
};
