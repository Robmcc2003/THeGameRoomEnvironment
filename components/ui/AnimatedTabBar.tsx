// airbnb-style tab bar: sliding pill indicator, semi-transparent bar, smooth animations
// ref: https://reactnativecomponents.com/components/tabs/airbnb-tabs
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from '../useColorScheme';
import Colors from '../../constants/Colors';
import { Dimensions, LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_NAMES = ['sign-out', 'home', 'profile', 'my-leagues'] as const;
const TAB_CONFIG: Record<string, { title: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }> = {
  'sign-out': { title: 'Sign Out', icon: 'sign-out' },
  home: { title: 'Home', icon: 'home' },
  profile: { title: 'Profile', icon: 'user' },
  'my-leagues': { title: 'My Leagues', icon: 'bars' },
};

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  descriptors: Record<string, { options?: { title?: string; tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode } }>;
  navigation: { navigate: (name: string) => void };
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function AnimatedTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;
  const isDark = colorScheme === 'dark';
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH);
  const activeIndex = useSharedValue(0);

  const visibleRoutes = state.routes.filter((r) => TAB_NAMES.includes(r.name as any));
  const currentRoute = state.routes[state.index];
  const visibleIndex = visibleRoutes.findIndex((r) => r.key === currentRoute?.key);
  const index = visibleIndex >= 0 ? visibleIndex : 0;

  // animate pill to active tab
  useEffect(() => {
    activeIndex.value = withTiming(index, {
      duration: 500,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [index, activeIndex]);

  // measure tab bar width for pill position
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setLayoutWidth(w);
  }, []);

  const tabWidth = layoutWidth > 0 ? layoutWidth / visibleRoutes.length : SCREEN_WIDTH / Math.max(1, visibleRoutes.length);
  const pillWidth = Math.max(0, tabWidth - 28);
  const pillLeftOffset = (tabWidth - pillWidth) / 2;

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: activeIndex.value * tabWidth }],
    };
  }, [tabWidth]);

  // Airbnb-style: semi-transparent bar (frosted look when no BlurView), subtle top border
  const barBackground = isDark ? 'rgba(26, 26, 26, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  const barBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: barBackground,
          paddingBottom: insets.bottom,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: barBorder,
        },
      ]}
      onLayout={onLayout}
    >
      <View style={[styles.tabsRow, { position: 'relative' }]}>
        {visibleRoutes.length > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: pillWidth,
                left: pillLeftOffset,
                backgroundColor: isDark ? `${tint}40` : `${tint}30`,
                borderRadius: 22,
                zIndex: 0,
                ...(Platform.OS === 'ios' && {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 3,
                }),
              },
              indicatorStyle,
            ]}
          />
        )}
        {visibleRoutes.map((route) => {
          const opts = descriptors[route.key]?.options ?? {};
          const config = TAB_CONFIG[route.name] ?? { title: route.name, icon: 'circle' as const };
          const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);
          const color = isFocused ? tint : colors.text;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={[styles.tab, { width: tabWidth || undefined, zIndex: 1 }]}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              {opts.tabBarIcon ? opts.tabBarIcon({ focused: isFocused, color, size: 26 }) : <FontAwesome name={config.icon} size={26} color={color} style={styles.icon} />}
              <Animated.Text style={[styles.label, { color }]} numberOfLines={1}>
                {opts.title ?? config.title}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    paddingTop: 10,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  indicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  icon: {
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
