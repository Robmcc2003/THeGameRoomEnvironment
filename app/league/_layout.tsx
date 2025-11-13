import { Stack } from 'expo-router';

export default function LeagueLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitleVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen 
        name="editleague" 
        options={{ 
          title: 'Edit League',
          presentation: 'card',
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: true,
        }} 
      />
      <Stack.Screen 
        name="[leagueId]/index" 
        options={{
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen 
        name="[leagueId]/add-member" 
        options={{ 
          title: 'Add Member',
          presentation: 'card',
          headerBackButtonDisplayMode: 'minimal',
        }} 
      />
      <Stack.Screen 
        name="[leagueId]/bracket" 
        options={{ 
          title: 'Tournament Bracket',
          presentation: 'card',
          headerBackButtonDisplayMode: 'minimal',
        }} 
      />
    </Stack>
  );
}

