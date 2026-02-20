// login, sign-up, password reset and profile creation; redirect verified users into app
// ref: Firebase Auth - https://firebase.google.com/docs/auth
// ref: Firestore - https://firebase.google.com/docs/firestore
// ref: Fancy login UI - https://reactnativecomponents.com/components/login/fancy-login

import { router } from 'expo-router'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView as SafeAreaViewContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { auth, db } from '../FirebaseConfig'
import Logo from '../components/Logo'
import { AppButton, AppInput, useAppTheme } from '../components/ui'

const index = () => {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // require email verification before main app access
        if (!user.emailVerified) {
          router.replace('/verify-email');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // validate email format
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const signIn = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password');
      return;
    }

    try {
      setSigningIn(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        // keep unverified users out of main app
        if (!userCredential.user.emailVerified) {
          router.replace('/verify-email');
          return;
        }

        const userRef = doc(db, 'users', userCredential.user.uid);
        const userSnap = await getDoc(userRef);
        
        // sync user doc with search fields for find friends
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

  // create normal user accounts; admins set via custom claims or Firebase Console
  const createUserProfile = async (userId: string, email: string, username: string) => {
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
      role: 'user',
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

      // fallback to legacy field for older user documents
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

    if (!isValidEmail(email)) {
      alert('Please enter a valid email address');
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

    // enforce stronger password for security
    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      alert('Password must contain at least one letter and one number');
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
        await createUserProfile(userCredential.user.uid, email, usernameTrimmed);

        // send verification email and navigate to verify screen
        try {
          await sendEmailVerification(userCredential.user);
        } catch {
        }

        router.replace('/verify-email');
      }
    } catch (error: any) {
      alert('Sign up failed: ' + (error.message || 'Unknown error'));
    } finally {
      setSigningUp(false);
    }
  }

  // send password reset email
  const onForgotPassword = async () => {
    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      alert('Enter your email first so I can send a reset link.');
      return;
    }
    if (!isValidEmail(emailTrimmed)) {
      alert('Please enter a valid email address.');
      return;
    }

    try {
      setResettingPassword(true);
      await sendPasswordResetEmail(auth, emailTrimmed);
      alert('Password reset email sent. Check your inbox.');
    } catch (e: any) {
      alert('Could not send reset email: ' + (e?.message || 'Unknown error'));
    } finally {
      setResettingPassword(false);
    }
  };

  const isDark = t.scheme === 'dark';
  const tint = t.colors.tint;

  if (loading) {
    return (
      <SafeAreaViewContext style={[styles.container, { backgroundColor: t.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Logo size="large" showTagline={true} />
          <ActivityIndicator size="large" color={tint} style={{ marginTop: 30 }} />
          <Text style={[styles.loadingTitle, { color: t.colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaViewContext>
    );
  }

  return (
    <SafeAreaViewContext
      style={[styles.container, { backgroundColor: t.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Bottom lightsaber-style red glow: extends into safe area to remove white strip */}
        <View
          style={[
            styles.glowContainer,
            {
              bottom: -insets.bottom,
              height: 160 + insets.bottom,
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.glowLayer, styles.glowLayerFar, { backgroundColor: tint + '12' }]} />
          <View style={[styles.glowLayer, styles.glowLayerMid, { backgroundColor: tint + '18' }]} />
          <View style={[styles.glowLayer, styles.glowLayerNear, { backgroundColor: tint + '18' }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Fancy header: logo + tint accent, extends to top of screen (no top safe inset) */}
          <View
            style={[
              styles.headerStrip,
              {
                backgroundColor: isDark ? tint + '28' : tint + '18',
                paddingTop: 24 + insets.top,
              },
            ]}
          >
            <View style={styles.logoSection}>
              <Logo size="large" showTagline={true} />
            </View>
          </View>

          {/* Form card */}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: t.colors.card,
                borderColor: t.colors.borderStrong,
                ...t.shadow.card,
                borderRadius: t.radius.lg,
              },
            ]}
          >
            <Text style={[styles.title, { color: t.colors.text }]}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text style={[styles.subtitle, { color: t.colors.mutedText }]}>
              {isSignUp ? 'Sign up to get started' : 'Sign in to continue'}
            </Text>

            {isSignUp && (
              <AppInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="username"
                maxLength={20}
              />
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
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              placeholder="password"
            />

            <TouchableOpacity
              onPress={() => setPasswordVisible(v => !v)}
              style={styles.linkRow}
            >
              <Text style={[styles.linkText, { color: t.colors.mutedText }]}>
                {passwordVisible ? 'Hide password' : 'Show password'}
              </Text>
            </TouchableOpacity>

            {!isSignUp && (
              <AppButton
                title="Sign in"
                onPress={signIn}
                loading={signingIn}
                disabled={signingIn || signingUp}
                style={styles.primaryButton}
              />
            )}

            {!isSignUp && (
              <TouchableOpacity
                onPress={onForgotPassword}
                disabled={resettingPassword || signingIn}
                style={styles.linkRow}
              >
                <Text style={[styles.linkText, { color: t.colors.mutedText }]}>
                  {resettingPassword ? 'Sending reset email…' : 'Forgot password?'}
                </Text>
              </TouchableOpacity>
            )}

            {isSignUp && (
              <AppButton
                title="Create Account"
                onPress={signUp}
                loading={signingUp}
                disabled={signingIn || signingUp}
                style={styles.primaryButton}
              />
            )}

            <TouchableOpacity
              onPress={() => {
                setIsSignUp(!isSignUp);
                setUsername('');
                setPasswordVisible(false);
              }}
              style={styles.toggleButton}
            >
              <Text style={[styles.toggleText, { color: t.colors.mutedText }]}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: tint, fontWeight: '800', textDecorationLine: 'underline' }}>
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaViewContext>
  )
}

export default index

// login screen styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  glowContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  glowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  glowLayerNear: {
    height: 56,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  glowLayerMid: {
    height: 100,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  glowLayerFar: {
    height: 160,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
  },
  headerStrip: {
    paddingTop: 24,
    paddingBottom: 36,
    marginHorizontal: -20,
    marginBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoSection: {
    alignItems: 'center',
  },
  formCard: {
    padding: 24,
    borderWidth: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    fontWeight: '600',
  },
  linkRow: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  primaryButton: {
    marginTop: 12,
  },
  toggleButton: {
    marginTop: 24,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
