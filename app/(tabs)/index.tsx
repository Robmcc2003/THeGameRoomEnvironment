// Sign Out Tab Screen
// Allows users to sign out of their account

import { useRouter } from 'expo-router';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import React from 'react';

export default function TabOneScreen() {
  const router = useRouter();

  // Handle sign out button press
  const handleSignOut = async () => {
    try {
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Navigate back to login screen
      // The root layout will handle redirecting based on auth state
      router.replace('/');
      
    } catch (error: any) {
      console.error('Sign out error:', error);
      // Even if signout fails, navigate to login screen
      router.replace('/');
      alert('Sign out failed: ' + (error?.message || 'Unknown error'));
    }
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* Logo section */}
        <View style={styles.logoSection}>
          <Logo size="large" showTagline={true} />
        </View>
        
        {/* Content section with sign out button */}
        <View style={styles.contentSection}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Sign out to switch accounts</Text>
          
          {/* Sign out button */}
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleSignOut}
          >
            <Text style={styles.text}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// Styles for the sign out screen
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  logoSection: {
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    marginBottom: 30,
    marginHorizontal: 20,
  },
  contentSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 40,
    fontWeight: '500',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#DC143C', // Red button
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC143C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#000000',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  }
});
