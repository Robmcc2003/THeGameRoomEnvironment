/**
 * Color Constants
 * 
 * This file defines the color palette for light and dark themes.
 * The app uses a consistent color scheme throughout:
 * - Primary color: Red (Crimson #DC143C)
 * - Text: Black (light mode) or White (dark mode)
 * - Background: White (light mode) or Dark Gray (dark mode)
 * - Borders: Black accents
 * 
 * These colors are used by the Themed components (Themed.tsx) to automatically
 * adapt to light/dark mode based on the user's system preferences.
 * 
 * Color values:
 * - #DC143C: Crimson red (primary accent color)
 * - #000000: Black
 * - #FFFFFF: White
 * - #999999: Dark gray (for inactive elements)
 * - #666666: Medium gray (for inactive elements in dark mode)
 * - #1A1A1A: Very dark gray (dark mode background)
 * - #2A2A2A: Dark gray (dark mode card background)
 * 
 * References:
 * - Color theory: https://en.wikipedia.org/wiki/Color_theory
 * - CSS Color Values: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
 */

// Tint color (accent color) - same for both themes
// This is the red color used for buttons, highlights, etc.
const tintColorLight = '#DC143C'; // Red (Crimson) for light theme
const tintColorDark = '#DC143C'; // Red (Crimson) for dark theme (same as light)

/**
 * Color Palette Export
 * 
 * This object contains color definitions for both light and dark themes.
 * Each theme has:
 * - text: Color for text content
 * - background: Color for screen backgrounds
 * - tint: Accent color (red)
 * - tabIconDefault: Color for inactive tab icons
 * - tabIconSelected: Color for active tab icons
 * - card: Color for card backgrounds
 * - border: Color for borders
 */
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
