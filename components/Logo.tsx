// display the "THE GAME ROOM" logo with a controller icon and optional tagline in small, medium, or large size.
// Logo design base: https://chatgpt.com/share/691da1e5-7c44-8007-9135-608c82d9689c | React Native: https://reactnative.dev/docs/stylesheet
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

type LogoProps = {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
};

export default function Logo({ size = 'medium', showTagline = true }: LogoProps) {
  const sizes = {
    small: { fontSize: 14, taglineSize: 10, controllerSize: 80 },
    medium: { fontSize: 20, taglineSize: 14, controllerSize: 100 },
    large: { fontSize: 26, taglineSize: 18, controllerSize: 120 },
  };

  const { fontSize, taglineSize, controllerSize } = sizes[size];
  const controllerHeight = controllerSize * 0.7;

  const handleWidth = controllerSize * 0.25;
  const handleHeight = controllerHeight * 0.6;
  const bodyWidth = controllerSize * 0.7;
  const bodyHeight = controllerHeight * 0.7;

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={[styles.topText, { fontSize }]}>THE GAME ROOM</Text>

        {/* I build the controller from nested Views: handles, body, d-pad, centre buttons, action buttons. */}
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

        {showTagline && (
          <Text style={[styles.bottomText, { fontSize: taglineSize }]}>
            FROM LIVING ROOMS TO LEAGUES
          </Text>
        )}
      </View>
    </View>
  );
}

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
    color: '#DC143C',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  bottomText: {
    fontWeight: '700',
    color: '#DC143C',
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
    backgroundColor: '#DC143C',
    borderRadius: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
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
