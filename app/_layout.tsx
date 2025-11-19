// Root Layout File
// This is the main entry point for navigation in the app.
// It handles:
// - App-wide navigation structure
// - Authentication state management
// - Theme (light/dark mode) setup
// - Font loading
// - Splash screen management
// This file uses Expo Router's file-based routing system.
// The file structure in the app/ directory determines the navigation structure.
// References:
// - Expo Router: https://docs.expo.dev/router/introduction/
// - Expo Fonts: https://docs.expo.dev/guides/using-custom-fonts/
// - Expo Splash Screen: https://docs.expo.dev/guides/splash-screens/
// - React Navigation: https://reactnavigation.org/
// - Firebase Auth State: https://firebase.google.com/docs/auth/web/manage-users#get_the_currently_signed-in_user

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '../components/useColorScheme';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../FirebaseConfig';

// Export Error Boundary
// This catches navigation errors and prevents the app from crashing.
// Expo Router provides this automatically.
// Error boundaries docs: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
export {
  ErrorBoundary
} from 'expo-router';

// Nav settings
// This sets the initial route when the app first loads.
// I set it to 'index' which is the login screen.
// Expo Router settings: https://docs.expo.dev/router/advanced/stack/
export const unstable_settings = {
  initialRouteName: 'index', // Start at login screen
};

// Prevent Splash Screen from Auto-Hiding
// I want to control when the splash screen hides (after fonts load).
// This prevents the splash screen from disappearing too early.
// Expo Splash Screen docs: https://docs.expo.dev/guides/splash-screens/
SplashScreen.preventAutoHideAsync();

// Root Layout Component
// This is the top-level component that wraps the entire app.
// It handles font loading and splash screen management.
export default function RootLayout() {
  // useFonts() loads custom fonts for the app.
  // I load SpaceMono font and FontAwesome icons.
  // Expo Fonts docs: https://docs.expo.dev/guides/using-custom-fonts/
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font, // FontAwesome icon fonts
  });

  // If there's an error loading fonts, throw it to the error boundary.
  // This will show an error screen instead of crashing the app.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Once fonts are loaded, I hide the splash screen.
  // This ensures fonts are ready before showing the app.
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // I return null while fonts are loading to prevent
  // the app from rendering with default fonts and then switching.
  if (!loaded) {
    return null;
  }

  // Once fonts are loaded, render the navigation component
  return <RootLayoutNav />;
}

// This component handles routing and authentication state.
// It listens for auth changes and redirects users appropriately.
function RootLayoutNav() {
  // Get device color scheme (light or dark mode)
  const colorScheme = useColorScheme();
  
  // Get router for navigation
  const router = useRouter();
  
  // Get current route segments (for checking which screen I'm on)
  const segments = useSegments();

  // Listen for Authentication State Changes
  // This effect listens for when users sign in or sign out.
  // When a user signs in from the login screen, I redirect them to the main app.
  // Firebase Auth state listener: https://firebase.google.com/docs/auth/web/manage-users#get_the_currently_signed-in_user
  // React useEffect docs: https://react.dev/reference/react/useEffect
  useEffect(() => {
    // Set up listener for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Get the current route (first segment)
      const currentSegment = segments[0] as string | undefined;
      // Check if I'm on the login screen
      const onLoginScreen = currentSegment === 'index' || !currentSegment;
      
      // If user is signed in and on login screen, redirect to main app
      if (user && onLoginScreen) {
        router.replace('/(tabs)');
      }
    });

    // Clean up listener when component unmounts
    return () => unsubscribe();
  }, [segments, router]);

  // Stack provides a navigation stack (like a stack of cards).
  // Each screen can navigate to another, and you can go back.
  // React Navigation Stack docs: https://reactnavigation.org/docs/stack-navigator/
  return (
    // ThemeProvider applies light/dark theme to navigation
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal', // Show minimal back button style
          headerBackVisible: true, // Always show back button when possible
        }}
      >
        {/* Login screen - no header (I handle my own header) */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        
        {/* Main tabs screen - no header (tabs have their own headers) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        
        {/* League screens - no header (handled by league layout file) */}
        <Stack.Screen name="league" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
