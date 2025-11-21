// Logo Component
// This component displays "THE GAME ROOM" logo with a stylized video game controller icon.
// It can be displayed in different sizes (small, medium, large) with an optional tagline.
// The logo consists of:
// - Top text: "THE GAME ROOM"
// - Controller icon: A custom-designed game controller made with React Native Views
// - Bottom text: "FROM LIVING ROOMS TO LEAGUES" (optional tagline)
// React Native Components Used:
// - View: Container for layout
// - Text: Text display
// - StyleSheet: For styling
// References:
// Created with the help of chatgpt as base of code for logo gen https://chatgpt.com/share/691da1e5-7c44-8007-9135-608c82d9689c
// - React Native Components: https://reactnative.dev/docs/components-and-apis
// - React Native StyleSheet: https://reactnative.dev/docs/stylesheet

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

// Logo Component Props
// These are the properties that can be passed to the Logo component.
type LogoProps = {
  size?: 'small' | 'medium' | 'large'; // Size of the logo (default: 'medium')
  showTagline?: boolean; // Whether to show "FROM LIVING ROOMS TO LEAGUES" tagline (default: true)
};

// Logo Component
// This is the main logo component that displays the app branding.
// @param size - Size variant of the logo
// @param showTagline - Whether to display the tagline
export default function Logo({ size = 'medium', showTagline = true }: LogoProps) {
  const sizes = {
    small: { fontSize: 14, taglineSize: 10, controllerSize: 80 },
    medium: { fontSize: 20, taglineSize: 14, controllerSize: 100 },
    large: { fontSize: 26, taglineSize: 18, controllerSize: 120 },
  };

  const { fontSize, taglineSize, controllerSize } = sizes[size];
  const controllerHeight = controllerSize * 0.7;
  
  // Calculate positions based on controller dimensions
  const handleWidth = controllerSize * 0.25;
  const handleHeight = controllerHeight * 0.6;
  const bodyWidth = controllerSize * 0.7;
  const bodyHeight = controllerHeight * 0.7;

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {/* Top Text - "THE GAME ROOM" */}
        <Text style={[styles.topText, { fontSize }]}>THE GAME ROOM</Text>

        {/* Controller Icon - Stylized Video Game Controller */}
        {/* I create a controller using nested Views to simulate the controller shape.
            This is a custom design made with React Native components.
            The controller has:
            - Left and right handles (grips)
            - Controller body (main section)
            - D-pad (directional pad) on the left
            - Center buttons (menu/start) in the middle
            - Action buttons (A, B, X, Y) on the right */}
        <View style={[styles.controllerContainer, { width: controllerSize, height: controllerHeight }]}>
          <View style={styles.controller}>
            <View style={[
              styles.handle,
              {
                width: handleWidth,
                height: handleHeight,
                left: -controllerSize * 0.12,
                top: controllerHeight * 0.2,
              }
            ]} />
            
            <View style={[
              styles.handle,
              {
                width: handleWidth,
                height: handleHeight,
                right: -controllerSize * 0.12,
                top: controllerHeight * 0.2,
              }
            ]} />
            
            <View style={[styles.controllerBody, { width: bodyWidth, height: bodyHeight }]}>
              <View style={[
                styles.dpad,
                {
                  left: bodyWidth * 0.08,
                  top: bodyHeight * 0.3,
                  width: bodyWidth * 0.2,
                  height: bodyHeight * 0.2,
                }
              ]}>
                <View style={[
                  styles.dpadVertical,
                  {
                    width: bodyWidth * 0.15,
                    height: bodyHeight * 0.6,
                  }
                ]} />
                <View style={[
                  styles.dpadHorizontal,
                  {
                    width: bodyWidth * 0.6,
                    height: bodyHeight * 0.15,
                  }
                ]} />
              </View>
              
              <View style={[
                styles.centerButtons,
                {
                  bottom: bodyHeight * 0.12,
                }
              ]}>
                <View style={styles.centerButton} />
                <View style={styles.centerButton} />
              </View>
              
              <View style={[
                styles.actionButtons,
                {
                  right: bodyWidth * 0.08,
                  top: bodyHeight * 0.25,
                  width: bodyWidth * 0.24,
                  height: bodyHeight * 0.24,
                }
              ]}>
                <View style={[
                  styles.actionButton,
                  {
                    width: bodyWidth * 0.24 * 0.3,
                    height: bodyHeight * 0.24 * 0.3,
                    top: 0,
                    left: bodyWidth * 0.24 * 0.35,
                  }
                ]} />
                <View style={[
                  styles.actionButton,
                  {
                    width: bodyWidth * 0.24 * 0.3,
                    height: bodyHeight * 0.24 * 0.3,
                    right: 0,
                    top: bodyHeight * 0.24 * 0.35,
                  }
                ]} />
                <View style={[
                  styles.actionButton,
                  {
                    width: bodyWidth * 0.24 * 0.3,
                    height: bodyHeight * 0.24 * 0.3,
                    bottom: 0,
                    left: bodyWidth * 0.24 * 0.35,
                  }
                ]} />
                <View style={[
                  styles.actionButton,
                  {
                    width: bodyWidth * 0.24 * 0.3,
                    height: bodyHeight * 0.24 * 0.3,
                    left: 0,
                    top: bodyHeight * 0.24 * 0.35,
                  }
                ]} />
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Text - Tagline (optional) */}
        {showTagline && (
          <Text style={[styles.bottomText, { fontSize: taglineSize }]}>
            FROM LIVING ROOMS TO LEAGUES
          </Text>
        )}
      </View>
    </View>
  );
}

// Styles for the Logo Component
// These styles create the visual appearance of the logo.
// The controller is built using absolute positioning to layer Views on top of each other.
// React Native StyleSheet docs: https://reactnative.dev/docs/stylesheet
const styles = StyleSheet.create({
  container: {
    alignItems: 'center', // Center horizontally
    justifyContent: 'center', // Center vertically
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // Allows absolute positioning of child elements
  },
  topText: {
    fontWeight: '900', // Extra bold
    color: '#DC143C', // Red color (Crimson)
    letterSpacing: 2, // Space between letters
    marginBottom: 8,
    textAlign: 'center',
  },
  bottomText: {
    fontWeight: '700', // Bold
    color: '#DC143C', // Red color
    letterSpacing: 1.5, // Space between letters
    marginTop: 8,
    textAlign: 'center',
  },
  controllerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12, // Margin top and bottom
  },
  controller: {
    width: '100%',
    height: '100%',
    position: 'relative', // Allows absolute positioning of handles
    alignItems: 'center',
    justifyContent: 'center',
  },
  controllerBody: {
    width: '70%', // Controller body is 70% of container width
    height: '70%', // Controller body is 70% of container height
    backgroundColor: '#DC143C', // Red controller body
    borderRadius: 12, // Rounded corners
    position: 'relative', // Allows absolute positioning of buttons
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3, // Thick black border
    borderColor: '#000000',
  },
  handle: {
    position: 'absolute',
    backgroundColor: '#DC143C',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#000000',
  },
  dpad: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadVertical: {
    position: 'absolute',
    backgroundColor: '#DC143C',
    borderRadius: 2,
  },
  dpadHorizontal: {
    position: 'absolute',
    backgroundColor: '#DC143C',
    borderRadius: 2,
  },
  centerButtons: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
  },
  centerButton: {
    width: 6,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  actionButtons: {
    position: 'absolute',
  },
  actionButton: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
});
