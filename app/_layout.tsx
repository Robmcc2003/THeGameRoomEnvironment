// root layout: app-wide navigation, auth state, theme, fonts and splash screen
// ref: Expo Router - https://docs.expo.dev/router/introduction/
// ref: Fonts - https://docs.expo.dev/guides/using-custom-fonts/
// ref: Splash - https://docs.expo.dev/guides/splash-screens/
// ref: Firebase Auth - https://firebase.google.com/docs/auth/web/manage-users#get_the_currently_signed-in_user
// ref: React Nav Theme - https://reactnavigation.org/docs/themes

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '../components/useColorScheme';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../FirebaseConfig';
import * as Notifications from 'expo-notifications';
import { listenForLatestUnreadNotification, registerNotificationsForCurrentUser } from '../components/lib/notifications';

// error boundary to catch navigation errors
// ref: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
export { ErrorBoundary } from 'expo-router';

// initial route is login screen
export const unstable_settings = {
  initialRouteName: 'index',
};

// prevent splash from auto-hiding so we control when it disappears
SplashScreen.preventAutoHideAsync();

// load fonts and manage splash screen
export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // render nav once fonts ready
  return <RootLayoutNav />;
}

// handle routing and auth state
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    // subscribe once to avoid navigation loops
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // routing logic separate from auth subscription
    const inTabs = segments[0] === '(tabs)';
    const onVerifyScreen = pathname === '/verify-email';
    const onLoginScreen = !inTabs && (pathname === '/' || pathname === '/index' || !pathname);

    // not signed in -> go to login if in tabs or verify screen
    if (!user) {
      if (inTabs || onVerifyScreen) {
        router.replace('/');
      }
      return;
    }

    // signed in but not verified -> keep on verify screen
    if (!user.emailVerified) {
      if (!onVerifyScreen) {
        router.replace('/verify-email');
      }
      return;
    }

    // signed in and verified -> stay in main app
    if (onLoginScreen || onVerifyScreen) {
      router.replace('/(tabs)');
    }
  }, [user?.uid, user?.emailVerified, segments, pathname, router]);

  // register notification permissions and listen for in-app notifications
  useEffect(() => {
    if (!user?.uid) return;

    let unsub: (() => void) | null = null;

    (async () => {
      await registerNotificationsForCurrentUser();

      unsub = listenForLatestUnreadNotification({
        userId: user.uid,
        onNotification: async (n) => {
          // show local alert whilst app is running (Expo Go friendly)
          await Notifications.scheduleNotificationAsync({
            content: {
              title: n.title,
              body: n.body,
              data: { notificationId: n.id, ...(n.data ?? {}) },
            },
            trigger: null,
          });
        },
      });
    })();

    return () => {
      unsub?.();
    };
  }, [user?.uid]);
  
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: true,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="league" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
