import React from 'react';
import { ViewStyle } from 'react-native';
import { Text, View } from '../Themed';
import { useAppTheme } from './theme';

type Props = {
  text: string;
  tone?: 'tint' | 'neutral' | 'success' | 'warning';
  style?: ViewStyle | ViewStyle[];
};

// I render a small badge/pill for status labels.
export function AppBadge({ text, tone = 'neutral', style }: Props) {
  const t = useAppTheme();

  const bg =
    tone === 'tint'
      ? t.colors.tint
      : tone === 'success'
        ? t.colors.success
        : tone === 'warning'
          ? t.colors.warning
          : t.scheme === 'dark'
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)';

  const fg = tone === 'neutral' ? t.colors.text : '#FFFFFF';

  return (
    <View
      style={[
        {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: t.radius.pill,
          backgroundColor: bg,
          borderWidth: t.borderWidth.regular,
          borderColor: t.colors.borderStrong,
        },
        style as any,
      ]}
    >
      <Text style={{ fontSize: 12, fontWeight: '800', color: fg, letterSpacing: 0.2 }}>{text}</Text>
    </View>
  );
}

