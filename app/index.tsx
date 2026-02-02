// Login and Signup Screen
// Main file to handle user authentication, sign up, and profile creation.
/* Authentication code (lines 35-68) adapted from Firebase Auth documentation - https://firebase.google.com/docs/auth */
/* User profile creation (lines 70-94) uses Firestore - https://firebase.google.com/docs/firestore */

import { router } from 'expo-router'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { auth, db } from '../FirebaseConfig'
import Logo from '../components/Logo'
import { AppButton, AppInput, useAppTheme } from '../components/ui'

const index = () => {
  const t = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

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

  const signIn = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password');
      return;
    }

    try {
      setSigningIn(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userSnap = await getDoc(userRef);
        
        const existing = userSnap.exists() ? (userSnap.data() as any) : null;
        const emailUsername = email.split('@')[0];
        const usernameValue = (existing?.username || emailUsername).trim();
        const displayNameValue = (existing?.displayName || existing?.username || emailUsername).trim();
        const needsSearchFields = !existing?.usernameLower || !existing?.displayNameLower;

        if (!userSnap.exists() || !existing?.username || needsSearchFields) {
          await setDoc(
            userRef,
            {
              email: email.toLowerCase(),
              emailLower: email.toLowerCase(),
              username: usernameValue,
              usernameLower: usernameValue.toLowerCase(),
              displayName: displayNameValue,
              displayNameLower: displayNameValue.toLowerCase(),
              updatedAt: serverTimestamp(),
              ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
            },
            { merge: true }
          );
        }
        
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      alert('Sign in failed: ' + (error.message || 'Unknown error'));
    } finally {
      setSigningIn(false);
    }
  }

  const createUserProfile = async (userId: string, email: string, username: string, role: 'user' | 'admin' = 'user') => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    const usernameValue = username.trim();
    const userData = {
      email: email.toLowerCase(),
      emailLower: email.toLowerCase(),
      username: usernameValue,
      usernameLower: usernameValue.toLowerCase(),
      displayName: usernameValue,
      displayNameLower: usernameValue.toLowerCase(),
      role: role,
      createdAt: userSnap.exists() ? userSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, userData, { merge: true });
  };

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const usernameLower = username.trim().toLowerCase();
      const usersQuery = query(
        collection(db, 'users'),
        where('usernameLower', '==', usernameLower)
      );
      const snapshot = await getDocs(usersQuery);
      if (!snapshot.empty) return false;

      // I fall back to the legacy field for older user documents.
      const legacyQuery = query(collection(db, 'users'), where('username', '==', username.trim()));
      const legacySnap = await getDocs(legacyQuery);
      return legacySnap.empty;
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        return true;
      }
      throw new Error('Unable to verify username availability. Please try again.');
    }
  };

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
    
    if (usernameTrimmed.length < 3) {
      alert('Username must be at least 3 characters');
      return;
    }

    if (usernameTrimmed.length > 20) {
      alert('Username must be 20 characters or less');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameTrimmed)) {
      alert('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setSigningUp(true);
      
      try {
        const isAvailable = await checkUsernameAvailability(usernameTrimmed);
        if (!isAvailable) {
          alert('This username is already taken. Please choose another.');
          setSigningUp(false);
          return;
        }
      } catch (checkError: any) {
        alert(checkError.message || 'Could not verify username availability. You can change it later if needed.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        await createUserProfile(userCredential.user.uid, email, usernameTrimmed, userRole);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      alert('Sign up failed: ' + (error.message || 'Unknown error'));
    } finally {
      setSigningUp(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Logo size="large" showTagline={true} />
          <ActivityIndicator size="large" color="#DC143C" style={{ marginTop: 30 }} />
          <Text style={[styles.title, { marginTop: 20 }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.colors.background }]}>
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
            <>
              <AppInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="username"
                maxLength={20}
              />
              
              <View style={styles.roleContainer}>
                <Text style={styles.roleLabel}>Account Type:</Text>
                <View style={styles.roleButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      userRole === 'user' && styles.roleButtonActive
                    ]}
                    onPress={() => setUserRole('user')}
                  >
                    <Text style={[
                      styles.roleButtonText,
                      userRole === 'user' && styles.roleButtonTextActive
                    ]}>
                      Normal User
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      userRole === 'admin' && styles.roleButtonActive
                    ]}
                    onPress={() => setUserRole('admin')}
                  >
                    <Text style={[
                      styles.roleButtonText,
                      userRole === 'admin' && styles.roleButtonTextActive
                    ]}>
                      Admin
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
          
          <AppInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email"
          />
          
          <AppInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="password"
          />
          
          {!isSignUp && (
            <AppButton
              title="Login"
              onPress={signIn}
              loading={signingIn}
              disabled={signingIn || signingUp}
              style={{ marginTop: 8 }}
            />
          )}
          
          {isSignUp && (
            <AppButton
              title="Create Account"
              onPress={signUp}
              loading={signingUp}
              disabled={signingIn || signingUp}
              style={{ marginTop: 8 }}
            />
          )}
          
          <TouchableOpacity 
            onPress={() => {
              setIsSignUp(!isSignUp);
              setUsername('');
              setUserRole('user'); // Reset to default role
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
  },
  roleContainer: {
    width: '100%',
    marginVertical: 12,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  }
});
