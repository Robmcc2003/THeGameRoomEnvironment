// Root Layout File
// I handle app-wide navigation, authentication state, theme, fonts, and splash screen.
/* Navigation structure (lines 11-109) adapted from Expo Router documentation - https://docs.expo.dev/router/introduction/ */
/* Font loading code (lines 37-40) from Expo Fonts guide - https://docs.expo.dev/guides/using-custom-fonts/ */
/* Splash screen handling (lines 32, 46-50) from Expo Splash Screen guide - https://docs.expo.dev/guides/splash-screens/ */
/* Authentication state listener (lines 68-85) adapted from Firebase Auth docs - https://firebase.google.com/docs/auth/web/manage-users#get_the_currently_signed-in_user */

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

// I export the error boundary to catch navigation errors.
// Reference: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
export { ErrorBoundary } from 'expo-router';

// I set the initial route to the login screen.
// Reference: https://docs.expo.dev/router/advanced/stack/
export const unstable_settings = {
  initialRouteName: 'index',
};

// I prevent the splash screen from auto-hiding so I can control when it disappears.
// Reference: https://docs.expo.dev/guides/splash-screens/
SplashScreen.preventAutoHideAsync();

// I load fonts and manage the splash screen.
// Reference: https://docs.expo.dev/guides/using-custom-fonts/
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

  return <RootLayoutNav />;
}

// I handle routing and authentication state.
// Reference: https://firebase.google.com/docs/auth/web/manage-users#get_the_currently_signed-in_user
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      const inTabs = segments[0] === '(tabs)';
      const onLoginScreen = !inTabs && (pathname === '/' || pathname === '/index' || !pathname);
      
      if (currentUser && onLoginScreen) {
        router.replace('/(tabs)');
      } else if (!currentUser && inTabs) {
        setTimeout(() => {
          router.replace('/');
        }, 100);
      }
    });

    return () => unsubscribe();
  }, [segments, router, pathname]);

  // I register notification permissions and listen for new in-app notifications.
  useEffect(() => {
    if (!user?.uid) return;

    let unsub: (() => void) | null = null;

    (async () => {
      await registerNotificationsForCurrentUser();

      unsub = listenForLatestUnreadNotification({
        userId: user.uid,
        onNotification: async (n) => {
          // I show a local alert while the app is running (Expo Go-friendly).
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
  
  const inTabs = segments[0] === '(tabs)';
  const shouldShowTabs = user || !inTabs;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: true,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {shouldShowTabs && (
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        )}
        <Stack.Screen name="league" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
