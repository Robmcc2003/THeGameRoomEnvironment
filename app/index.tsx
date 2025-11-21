// Login and Signup Screen
// This is the authentication screen where users can sign in or create a new account.
// It includes username validation and user profile creation.

import { router } from 'expo-router'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { auth, db } from '../FirebaseConfig'
import Logo from '../components/Logo'

const index = () => {
  // Component state
  const [email, setEmail] = useState(''); // User's email address
  const [password, setPassword] = useState(''); // User's password
  const [username, setUsername] = useState(''); // User's chosen username (for signup)
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between sign in and sign up modes
  const [loading, setLoading] = useState(true); // Loading state for checking auth status
  const [signingIn, setSigningIn] = useState(false); // Loading state for sign in process
  const [signingUp, setSigningUp] = useState(false); // Loading state for sign up process

  // Check if user is already signed in
  // This effect listens for authentication state changes and redirects signed-in users to the main app.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/(tabs)');
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle user sign in
  // This function authenticates the user with Firebase Auth and ensures their profile exists.
  const signIn = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password');
      return;
    }

    try {
      setSigningIn(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        // Ensure user profile exists (for backward compatibility)
        // I check if the user has a profile and create/update it if needed.
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists() || !userSnap.data()?.username) {
          const emailUsername = email.split('@')[0];
          await setDoc(userRef, {
            email: email.toLowerCase(),
            emailLower: email.toLowerCase(),
            username: userSnap.data()?.username || emailUsername,
            displayName: userSnap.data()?.displayName || emailUsername,
            updatedAt: serverTimestamp(),
            ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
          }, { merge: true });
        }
        
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.log(error);
      alert('Sign in failed: ' + (error.message || 'Unknown error'));
    } finally {
      setSigningIn(false);
    }
  }

  // Create user profile in Firestore
  // This function creates or updates a user's profile document with their email and username.
  const createUserProfile = async (userId: string, email: string, username: string) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    const userData = {
      email: email.toLowerCase(),
      emailLower: email.toLowerCase(),
      username: username.trim(),
      displayName: username.trim(),
      createdAt: userSnap.exists() ? userSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, userData, { merge: true });
  };

  // Check if username is available
  // This function queries Firestore to see if a username is already taken.
  // Returns true if available, false if taken.
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', username.trim())
      );
      const snapshot = await getDocs(usersQuery);
      return snapshot.empty;
    } catch (error: any) {
      console.error('Error checking username:', error);
      // If permission is denied, I allow signup to proceed (for backward compatibility)
      if (error?.code === 'permission-denied') {
        console.warn('Permission denied checking username - allowing signup to proceed');
        return true;
      }
      throw new Error('Unable to verify username availability. Please try again.');
    }
  };

  // Handle user sign up
  // This function validates inputs, checks username availability, creates the Firebase Auth account, and creates the user profile.
  const signUp = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password');
      return;
    }

    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    const usernameTrimmed = username.trim();
    
    // Validate username length
    if (usernameTrimmed.length < 3) {
      alert('Username must be at least 3 characters');
      return;
    }

    if (usernameTrimmed.length > 20) {
      alert('Username must be 20 characters or less');
      return;
    }

    // Validate username format (only letters, numbers, and underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(usernameTrimmed)) {
      alert('Username can only contain letters, numbers, and underscores');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setSigningUp(true);
      
      // Check if username is available before creating account
      try {
        const isAvailable = await checkUsernameAvailability(usernameTrimmed);
        if (!isAvailable) {
          alert('This username is already taken. Please choose another.');
          setSigningUp(false);
          return;
        }
      } catch (checkError: any) {
        console.warn('Username availability check failed:', checkError);
        alert(checkError.message || 'Could not verify username availability. You can change it later if needed.');
      }

      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        // Create user profile in Firestore
        await createUserProfile(userCredential.user.uid, email, usernameTrimmed);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.log(error);
      alert('Sign up failed: ' + (error.message || 'Unknown error'));
    } finally {
      setSigningUp(false);
    }
  }

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Logo size="large" showTagline={true} />
        </View>
        
        <View style={styles.formSection}>
          <Text style={styles.title}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
          <Text style={styles.subtitle}>{isSignUp ? 'Sign up to get started' : 'Sign in to continue'}</Text>
          
          {isSignUp && (
            <TextInput 
              style={styles.textInput} 
              placeholder="username" 
              value={username} 
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholderTextColor="#999999"
              maxLength={20}
            />
          )}
          
          <TextInput 
            style={styles.textInput} 
            placeholder="email" 
            value={email} 
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#999999"
          />
          
          <TextInput 
            style={styles.textInput} 
            placeholder="password" 
            value={password} 
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor="#999999"
          />
          
          {!isSignUp && (
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
          )}
          
          {isSignUp && (
            <TouchableOpacity 
              style={[styles.button, signingUp && styles.buttonDisabled]} 
              onPress={signUp}
              disabled={signingIn || signingUp}
            >
              {signingUp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.text}>Create Account</Text>
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            onPress={() => {
              setIsSignUp(!isSignUp);
              setUsername('');
            }}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default index

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
    backgroundColor: '#DC143C',
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
    backgroundColor: '#000000',
    borderColor: '#DC143C',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleButton: {
    marginTop: 20,
    paddingVertical: 12,
  },
  toggleText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  }
});
