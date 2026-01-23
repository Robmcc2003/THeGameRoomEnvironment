// Sign Out Tab Screen
// I handle user sign out and navigation back to login.
/* Sign out functionality (lines 31-61) from Firebase Auth - https://firebase.google.com/docs/reference/js/auth#signout */

import { useRouter } from 'expo-router';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import React from 'react';

export default function TabOneScreen() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }
    
    setIsSigningOut(true);
    
    try {
      router.replace('/');
      await new Promise(resolve => setTimeout(resolve, 200));
      await firebaseSignOut(auth);
    } catch (error: any) {
      setIsSigningOut(false);
      alert('Sign out failed: ' + (error?.message || 'Unknown error'));
    }
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        <View style={styles.logoSection}>
          <Logo size="large" showTagline={true} />
        </View>
        
        <View style={styles.contentSection}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Sign out to switch accounts</Text>
          
          <TouchableOpacity 
            style={[styles.button, isSigningOut && styles.buttonDisabled]} 
            onPress={handleSignOut}
            disabled={isSigningOut}
          >
            <Text style={styles.text}>
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

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
    backgroundColor: '#DC143C',
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
