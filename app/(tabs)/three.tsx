// My Badges Tab Screen
// Placeholder screen for future badges/achievements feature

import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

export default function TabTwoScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.mainTitle}>Storage</Text>
    </SafeAreaView>
  );
}

// Styles for the badges screen
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
