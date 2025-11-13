// Root layout file - handles app-wide navigation and authentication state
// This is the main entry point for navigation in the app

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '../components/useColorScheme';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../FirebaseConfig';

// Export error boundary to catch navigation errors
export {
  ErrorBoundary
} from 'expo-router';

// Navigation settings - set initial route to login screen
export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent splash screen from hiding until fonts are loaded
SplashScreen.preventAutoHideAsync();

// Main root layout component
export default function RootLayout() {
  // Load custom fonts (SpaceMono and FontAwesome icons)
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // If there's an error loading fonts, throw it to the error boundary
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Don't render anything until fonts are loaded
  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

// Navigation component that handles routing and authentication
function RootLayoutNav() {
  const colorScheme = useColorScheme(); // Get device color scheme (light/dark)
  const router = useRouter(); // Router for navigation
  const segments = useSegments(); // Current route segments

  // Listen for authentication state changes
  // When user signs in from login screen, redirect them to the tabs
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const currentSegment = segments[0]; // Get current route
      const onLoginScreen = currentSegment === 'index' || !currentSegment;
      
      // If user is signed in and on login screen, redirect to main app
      if (user && onLoginScreen) {
        router.replace('/(tabs)');
      }
    });

    // Clean up listener when component unmounts
    return () => unsubscribe();
  }, [segments, router]);

  // Render navigation stack with theme
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal', // Show minimal back button
          headerBackVisible: true, // Always show back button
        }}
      >
        {/* Login screen - no header */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* Main tabs screen - no header */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* League screens - no header (handled by league layout) */}
        <Stack.Screen name="league" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
