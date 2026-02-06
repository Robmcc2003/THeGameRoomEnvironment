// I set up the Stack for user profile screens (e.g. public profile by userId).
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

