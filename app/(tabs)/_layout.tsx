// I define the bottom tab bar with four tabs: Sign Out, Home, Profile, and My Leagues.
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

// I render a single tab bar icon using FontAwesome.
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

// I render the main tab layout and wire up each tab screen.
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      initialRouteName="sign-out"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}>
      {/* Hidden index route - only used for /(tabs) navigation, not shown in tab bar */}
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      {/* Tab 1: Sign Out screen */}
      <Tabs.Screen
        name="sign-out"
        options={{
          title: 'Sign Out',
          tabBarIcon: ({ color }) => <TabBarIcon name="sign-out" color={color} />,
        }}
      />
      
      {/* Tab 2: Home screen - Explore leagues */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      
      {/* Tab 3: Profile screen - User stats and tournament history */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      
      {/* Tab 4: My Leagues screen - Create and manage leagues */}
      <Tabs.Screen
        name="my-leagues"
        options={{
          title: 'My Leagues',
          tabBarIcon: ({ color }) => <TabBarIcon name="bars" color={color} />,
        }}
      />
    </Tabs>
  );
}
