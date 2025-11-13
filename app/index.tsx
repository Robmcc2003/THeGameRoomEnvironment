// Login and Sign Up Screen
// This is the first screen users see when they open the app
// Handles user authentication (sign in and sign up)

import { router } from 'expo-router'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { auth } from '../FirebaseConfig'
import Logo from '../components/Logo'

// Main login component
const index = () => {
  // State for email and password input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Loading state - true while checking if user is already signed in
  const [loading, setLoading] = useState(true);
  
  // States to track if sign in/sign up is in progress (prevents double-clicks)
  const [signingIn, setSigningIn] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  // Check if user is already signed in when screen loads
  // If signed in, redirect to main app
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, go to main app
        router.replace('/(tabs)');
      } else {
        // User is not signed in, show login form
        setLoading(false);
      }
    });
    // Clean up listener when component unmounts
    return () => unsubscribe();
  }, []);

  // Handle sign in button press
  const signIn = async () => {
    // Validate inputs
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password');
      return;
    }

    try {
      setSigningIn(true);
      // Sign in with Firebase
      const user = await signInWithEmailAndPassword(auth, email, password);
      if (user) {
        // Success - redirect to main app (handled by auth state listener)
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.log(error);
      // Show error message to user
      alert('Sign in failed: ' + (error.message || 'Unknown error'));
    } finally {
      setSigningIn(false);
    }
  }

  // Handle sign up button press
  const signUp = async () => {
    // Validate inputs
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password');
      return;
    }

    // Password must be at least 6 characters (Firebase requirement)
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setSigningUp(true);
      // Create new account with Firebase
      const user = await createUserWithEmailAndPassword(auth, email, password);
      if (user) {
        // Success - redirect to main app (handled by auth state listener)
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.log(error);
      // Show error message to user
      alert('Sign up failed: ' + (error.message || 'Unknown error'));
    } finally {
      setSigningUp(false);
    }
  }

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Logo size="large" showTagline={true} />
          <ActivityIndicator size="large" color="#DC143C" style={{ marginTop: 30 }} />
          <Text style={[styles.title, { marginTop: 20 }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main login form UI
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo section at top */}
        <View style={styles.logoSection}>
          <Logo size="large" showTagline={true} />
        </View>
        
        {/* Login form section */}
        <View style={styles.formSection}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
          
          {/* Email input field */}
          <TextInput 
            style={styles.textInput} 
            placeholder="email" 
            value={email} 
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#999999"
          />
          
          {/* Password input field */}
          <TextInput 
            style={styles.textInput} 
            placeholder="password" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor="#999999"
          />
          
          {/* Sign in button */}
          <TouchableOpacity 
            style={[styles.button, signingIn && styles.buttonDisabled]} 
            onPress={signIn}
            disabled={signingIn || signingUp}
          >
            {signingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.text}>Login</Text>
            )}
          </TouchableOpacity>
          
          {/* Sign up button */}
          <TouchableOpacity 
            style={[styles.button, styles.buttonSecondary, signingUp && styles.buttonDisabled]} 
            onPress={signUp}
            disabled={signingIn || signingUp}
          >
            {signingUp ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.text}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default index

// Styles for the login screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  formSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
    color: '#000000',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 32,
    fontWeight: '500',
  },
  textInput: {
    height: 56,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 2,
    borderRadius: 12,
    marginVertical: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  button: {
    width: '100%',
    marginVertical: 10,
    backgroundColor: '#DC143C', // Red button
    padding: 18,
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
  buttonSecondary: {
    backgroundColor: '#000000', // Black button
    borderColor: '#DC143C',
  },
  buttonDisabled: {
    opacity: 0.6, // Dim button when disabled
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  }
});
