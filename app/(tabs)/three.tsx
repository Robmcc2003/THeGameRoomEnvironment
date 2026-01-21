/**
 * My Badges Tab Screen
 * This is a placeholder screen for a future badges/achievements feature.
 */

import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

export default function TabThreeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.mainTitle}>My Badges</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
});
