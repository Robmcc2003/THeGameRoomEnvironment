/**
 * Sign Out Tab Screen
 * References:
 * - Firebase Auth signOut: https://firebase.google.com/docs/reference/js/auth#signout
 * - Expo Router: https://docs.expo.dev/router/introduction/
 * - React Native Components: https://reactnative.dev/docs/components-and-apis
 */

import { useRouter } from 'expo-router';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import React from 'react';

/**
 * This is the main component for the Account/Sign Out tab.
 */
export default function TabOneScreen() {
  // Get router for navigation
  const router = useRouter();

  /**
   * This function is called when the user taps the "Sign Out" button.
   * It signs the user out of Firebase and navigates back to the login screen.
   * Firebase signOut docs: https://firebase.google.com/docs/reference/js/auth#signout
   */
  const handleSignOut = async () => {
    try {
      // Sign out from Firebase Authentication
      // This clears the user's authentication session
      await firebaseSignOut(auth);
      
      // Navigate back to login screen
      // router.replace() replaces the current screen as i cant go back 
      // The root layout will also handle redirecting based on auth state
      // Expo Router docs: https://docs.expo.dev/router/navigating-pages/
      router.replace('/');
      
    } catch (error: any) {
      console.error('Sign out error:', error);
      // Even if signout fails, navigate to login screen
      // This ensures the user can still access the app
      router.replace('/');
      // Show error message to user
      alert('Sign out failed: ' + (error?.message || 'Unknown error'));
    }
  };

  /**
   * Main UI
   * This renders the sign out screen with logo and sign out button.
   */
  return (
    <ScrollView 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false} // Hide scrollbar
    >
      <View style={styles.container}>
        {/* Logo section at top */}
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
            onPress={handleSignOut} // Call handleSignOut when pressed
          >
            <Text style={styles.text}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * Styles for the Sign Out Screen
 * StyleSheet.create() creates optimized styles for React Native.
 * React Native StyleSheet docs: https://reactnative.dev/docs/stylesheet
 */
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1, // Allow content to grow and scroll
    paddingBottom: 40,
  },
  container: {
    flex: 1, // Take up full screen
    backgroundColor: '#FFFFFF', // White background
  },
  logoSection: {
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center', // Center logo horizontally
    borderBottomWidth: 2, // Black border at bottom
    borderBottomColor: '#000000',
    marginBottom: 30,
    marginHorizontal: 20,
  },
  contentSection: {
    paddingHorizontal: 20, // Padding on left and right
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900', // Extra bold
    color: '#000000',
    marginBottom: 8,
    letterSpacing: 0.5, // Space between letters
  },
  subtitle: {
    fontSize: 16,
    color: '#666666', // Gray color
    marginBottom: 40,
    fontWeight: '500',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 400, // Don't make button too wide on large screens
    backgroundColor: '#DC143C', // Red button (Crimson)
    padding: 20,
    borderRadius: 12, // Rounded corners
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC143C', // Shadow color matches button
    shadowOffset: { width: 0, height: 4 }, // Shadow offset
    shadowOpacity: 0.3, // Shadow transparency
    shadowRadius: 8, // Shadow blur
    elevation: 5, // Android shadow
    borderWidth: 2,
    borderColor: '#000000', // Black border
  },
  buttonDisabled: {
    opacity: 0.7, // Dim button when disabled
  },
  text: {
    color: '#FFFFFF', // White text
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  }
});
