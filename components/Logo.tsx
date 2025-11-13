// Logo Component
// Displays "THE GAME ROOM" logo with a video game controller icon
// Can be displayed in different sizes with optional tagline

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

// Props for the Logo component
type LogoProps = {
  size?: 'small' | 'medium' | 'large'; // Size of the logo
  showTagline?: boolean; // Whether to show "FROM LIVING ROOMS TO LEAGUES" tagline
};

export default function Logo({ size = 'medium', showTagline = true }: LogoProps) {
  // Define sizes for different logo variants
  const sizes = {
    small: { fontSize: 14, taglineSize: 10, controllerSize: 80 },
    medium: { fontSize: 20, taglineSize: 14, controllerSize: 100 },
    large: { fontSize: 26, taglineSize: 18, controllerSize: 120 },
  };

  const { fontSize, taglineSize, controllerSize } = sizes[size];

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {/* Top Text - "THE GAME ROOM" */}
        <Text style={[styles.topText, { fontSize }]}>THE GAME ROOM</Text>

        {/* Controller Icon - Stylized video game controller */}
        <View style={[styles.controllerContainer, { width: controllerSize, height: controllerSize * 0.7 }]}>
          <View style={styles.controller}>
            {/* Left handle */}
            <View style={[styles.handle, styles.leftHandle]} />
            {/* Right handle */}
            <View style={[styles.handle, styles.rightHandle]} />
            {/* Controller body */}
            <View style={styles.controllerBody}>
              {/* D-pad (directional pad) on left */}
              <View style={styles.dpad}>
                <View style={styles.dpadVertical} />
                <View style={styles.dpadHorizontal} />
              </View>
              {/* Center buttons (menu/start) */}
              <View style={styles.centerButtons}>
                <View style={styles.centerButton} />
                <View style={styles.centerButton} />
              </View>
              {/* Action buttons (A, B, X, Y) on right */}
              <View style={styles.actionButtons}>
                <View style={[styles.actionButton, styles.actionButtonTop]} />
                <View style={[styles.actionButton, styles.actionButtonRight]} />
                <View style={[styles.actionButton, styles.actionButtonBottom]} />
                <View style={[styles.actionButton, styles.actionButtonLeft]} />
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Text - "FROM LIVING ROOMS TO LEAGUES" tagline */}
        {showTagline && (
          <Text style={[styles.bottomText, { fontSize: taglineSize }]}>
            FROM LIVING ROOMS TO LEAGUES
          </Text>
        )}
      </View>
    </View>
  );
}

// Styles for the logo component
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  topText: {
    fontWeight: '900',
    color: '#DC143C', // Red color
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  bottomText: {
    fontWeight: '700',
    color: '#DC143C', // Red color
    letterSpacing: 1.5,
    marginTop: 8,
    textAlign: 'center',
  },
  controllerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  controller: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controllerBody: {
    width: '70%',
    height: '70%',
    backgroundColor: '#DC143C', // Red controller body
    borderRadius: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#000000', // Black border
  },
  handle: {
    position: 'absolute',
    width: '25%',
    height: '60%',
    backgroundColor: '#DC143C', // Red handles
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#000000', // Black border
  },
  leftHandle: {
    left: '-12%',
    top: '20%',
  },
  rightHandle: {
    right: '-12%',
    top: '20%',
  },
  dpad: {
    position: 'absolute',
    left: '8%',
    top: '30%',
    width: '20%',
    height: '20%',
    backgroundColor: '#FFFFFF', // White D-pad
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadVertical: {
    position: 'absolute',
    width: '15%',
    height: '60%',
    backgroundColor: '#DC143C', // Red cross
    borderRadius: 2,
  },
  dpadHorizontal: {
    position: 'absolute',
    width: '60%',
    height: '15%',
    backgroundColor: '#DC143C', // Red cross
    borderRadius: 2,
  },
  centerButtons: {
    position: 'absolute',
    bottom: '12%',
    flexDirection: 'row',
    gap: 8,
  },
  centerButton: {
    width: 6,
    height: 2,
    backgroundColor: '#FFFFFF', // White buttons
    borderRadius: 1,
  },
  actionButtons: {
    position: 'absolute',
    right: '8%',
    top: '25%',
    width: '24%',
    height: '24%',
  },
  actionButton: {
    position: 'absolute',
    width: '30%',
    height: '30%',
    backgroundColor: '#FFFFFF', // White buttons
    borderRadius: 4,
  },
  actionButtonTop: {
    top: 0,
    left: '35%',
  },
  actionButtonRight: {
    right: 0,
    top: '35%',
  },
  actionButtonBottom: {
    bottom: 0,
    left: '35%',
  },
  actionButtonLeft: {
    left: 0,
    top: '35%',
  },
});
