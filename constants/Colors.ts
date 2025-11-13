// Color Constants
// Defines the color palette for light and dark themes
// Uses white, red (crimson), and black as the main colors

const tintColorLight = '#DC143C'; // Red (Crimson) for light theme
const tintColorDark = '#DC143C'; // Red (Crimson) for dark theme

export default {
  light: {
    text: '#000000', // Black text
    background: '#FFFFFF', // White background
    tint: tintColorLight, // Red accent color
    tabIconDefault: '#999999', // Dark gray for inactive tabs
    tabIconSelected: tintColorLight, // Red for active tab
    card: '#FFFFFF', // White card background
    border: '#000000', // Black border accents
  },
  dark: {
    text: '#FFFFFF', // White text
    background: '#1A1A1A', // Very dark (almost black) background
    tint: tintColorDark, // Red accent color
    tabIconDefault: '#666666', // Medium gray for inactive tabs
    tabIconSelected: tintColorDark, // Red for active tab
    card: '#2A2A2A', // Dark gray card background
    border: '#000000', // Black border accents
  },
};
