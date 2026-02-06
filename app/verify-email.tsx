// I show the verify-email screen and require verification before allowing access to the main app.
// Ref: Firebase Auth email verification - https://firebase.google.com/docs/auth
import { Stack, useRouter } from 'expo-router';
import { sendEmailVerification, signOut as firebaseSignOut } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, TouchableOpacity, View as RNView } from 'react-native';
import { auth } from '../FirebaseConfig';
import Logo from '../components/Logo';
import { Text } from '../components/Themed';
import { AppButton, AppCard, useAppTheme } from '../components/ui';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (user?.emailVerified) {
      router.replace('/(tabs)');
    }
  }, [user?.emailVerified, router]);

  const onCheckAgain = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      router.replace('/');
      return;
    }

    try {
      setChecking(true);
      await current.reload();
      if (auth.currentUser?.emailVerified) {
        router.replace('/(tabs)');
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  const onResend = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return;
    try {
      setSending(true);
      await sendEmailVerification(current);
    } catch (e: any) {
    } finally {
      setSending(false);
    }
  }, []);

  const onSignOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } finally {
      router.replace('/');
    }
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Verify email', headerBackVisible: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <RNView style={{ padding: 20, paddingBottom: 40, gap: 16 }}>
          <RNView style={{ alignItems: 'center', marginTop: 10 }}>
            <Logo size="large" showTagline={true} />
          </RNView>

          <AppCard>
            <Text style={{ fontSize: 22, fontWeight: '900' }}>Verify your email</Text>
            <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '600', lineHeight: 20 }}>
              I’ve sent a verification link to:
            </Text>
            <Text style={{ marginTop: 6, fontWeight: '900' }}>{user?.email ?? 'your email'}</Text>
            <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '600', lineHeight: 20 }}>
              Open your inbox, tap the link, then come back here and press “I’ve verified”.
            </Text>

            <RNView style={{ marginTop: 16, gap: 12 }}>
              <AppButton
                title={checking ? 'Checking…' : "I've verified"}
                onPress={onCheckAgain}
                loading={checking}
              />

              <AppButton
                title={sending ? 'Sending…' : 'Resend verification email'}
                variant="secondary"
                onPress={onResend}
                loading={sending}
              />

              <TouchableOpacity onPress={onSignOut} style={{ marginTop: 6 }}>
                <Text style={{ color: t.colors.mutedText, fontWeight: '700', textDecorationLine: 'underline' }}>
                  Sign out
                </Text>
              </TouchableOpacity>
            </RNView>
          </AppCard>
        </RNView>
      </SafeAreaView>
    </>
  );
}

