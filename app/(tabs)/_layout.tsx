// bottom tab bar: sign out, home, profile, my leagues with custom sliding indicator based on the airbnb feel
// ref: Airbnb tabs - https://reactnativecomponents.com/components/tabs/airbnb-tabs
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';
import { Easing } from 'react-native';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';
import { AnimatedTabBar } from '../../components/ui/AnimatedTabBar';

// render tab icon from FontAwesome
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: 2 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      initialRouteName="sign-out"
      tabBar={(props) => <AnimatedTabBar {...(props as any)} />}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        // match tab bar pill timing: 500ms atm, but might tweak it
        animation: 'fade',
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: 500,
            easing: Easing.inOut(Easing.cubic),
          },
        },
      }}>
      {/* hidden index route for /(tabs) navigation, not in tab bar */}
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      {/* sign out tab */}
      <Tabs.Screen
        name="sign-out"
        options={{
          title: 'Sign Out',
          tabBarIcon: ({ color }) => <TabBarIcon name="sign-out" color={color} />,
        }}
      />
      
      {/* home tab: explore leagues */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      
      {/* profile tab: stats and tournament history */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      
      {/* my leagues tab: create and manage leagues */}
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
