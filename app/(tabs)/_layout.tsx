// Tab Navigation Layout
// Defines the bottom tab bar with 4 tabs: Sign Out, Home, My Badges, My Leagues

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

// Component to render tab bar icons
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

// Main tab layout component
export default function TabLayout() {
  const colorScheme = useColorScheme(); // Get device color scheme

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint, // Red color for active tab
        headerShown: false, // Hide header on all tab screens
      }}>
      {/* Tab 1: Sign Out screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Sign Out',
          tabBarIcon: ({ color }) => <TabBarIcon name="sign-out" color={color} />,
        }}
      />
      
      {/* Tab 2: Home screen - Explore leagues */}
      <Tabs.Screen
        name="two"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      
      {/* Tab 3: My Badges screen (placeholder) */}
      <Tabs.Screen
        name="three"
        options={{
          title: 'My Badges',
          tabBarIcon: ({ color }) => <TabBarIcon name="star" color={color} />,
        }}
      />
      
      {/* Tab 4: My Leagues screen - Create and manage leagues */}
      <Tabs.Screen
        name="four"
        options={{
          title: 'My Leagues',
          tabBarIcon: ({ color }) => <TabBarIcon name="bars" color={color} />,
        }}
      />
    </Tabs>
  );
}
