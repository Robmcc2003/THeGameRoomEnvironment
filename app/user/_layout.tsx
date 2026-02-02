// User Profile Layout
// I configure the navigation stack for user profile screens.
import { Stack } from 'expo-router';

export default function UserLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: true,
      }}
    />
  );
}

