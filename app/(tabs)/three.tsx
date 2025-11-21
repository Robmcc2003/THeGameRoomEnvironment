/**
 * My Badges Tab Screen
 * This is just a placeholder screen for a future badges/achievements feature.
 * PLANNED FOR IT 3!
 * References:
 * - React Native SafeAreaView: https://reactnative.dev/docs/safeareaview
 * - React Native StyleSheet: https://reactnative.dev/docs/stylesheet
 */

import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

/**
 * Tab Three Screen Component
 * This is a simple placeholder component that will be expanded in the future.
 */
export default function TabTwoScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.mainTitle}>Storage</Text>
    </SafeAreaView>
  );
}

/**
 * Styles for the Badges Screen
 * React Native StyleSheet docs: https://reactnative.dev/docs/stylesheet
 */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    alignItems: 'center', // Center horizontally
    justifyContent: 'center', // Center vertically
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
});
