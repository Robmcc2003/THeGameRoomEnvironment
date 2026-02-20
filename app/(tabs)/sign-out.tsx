// sign out tab: handle sign out and navigate back to login
// cant get this to boot the person back to sign in page. Must come back to it
// ref: Firebase Auth signOut - https://firebase.google.com/docs/reference/js/auth#signout

import { useRouter } from 'expo-router';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { auth } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import React from 'react';
import { AppButton, AppCard, useAppTheme } from '../../components/ui';

export default function TabOneScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  // confirm then sign out and navigate to login
  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    Alert.alert('Sign out?', 'I will sign you out of this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await firebaseSignOut(auth);
            router.replace('/');
          } catch (error: any) {
            setIsSigningOut(false);
            alert('Sign out failed: ' + (error?.message || 'Unknown error'));
          }
        },
      },
    ]);
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.container, { backgroundColor: t.colors.background }]}>
        <View style={styles.logoSection}>
          <Logo size="large" showTagline={true} />
        </View>
        
        <View style={styles.contentSection}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Sign out to switch accounts</Text>

          <AppCard style={{ width: '100%', maxWidth: 420, marginTop: 6 }}>
            <Text style={{ fontWeight: '800' }}>Signed in as</Text>
            <Text style={{ marginTop: 6, color: t.colors.mutedText, fontWeight: '700' }}>
              {auth.currentUser?.email ?? 'Unknown'}
            </Text>
            <AppButton
              title={isSigningOut ? 'Signing out…' : 'Sign out'}
              variant="danger"
              onPress={handleSignOut}
              disabled={isSigningOut}
              style={{ marginTop: 16 }}
            />
          </AppCard>
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
});
