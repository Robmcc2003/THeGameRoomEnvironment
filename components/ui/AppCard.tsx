import React from 'react';
import { ViewStyle } from 'react-native';
import { View } from '../Themed';
import { useAppTheme } from './theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  variant?: 'default' | 'soft';
};

// I render a consistent card surface across the app.
export function AppCard({ children, style, padded = true, variant = 'default' }: Props) {
  const t = useAppTheme();
  const bg =
    variant === 'soft'
      ? t.scheme === 'dark'
        ? 'rgba(220,20,60,0.10)'
        : 'rgba(220,20,60,0.05)'
      : t.colors.card;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: t.radius.lg,
          borderWidth: t.borderWidth.regular,
          borderColor: t.colors.borderStrong,
          ...(padded ? { padding: t.spacing.lg } : null),
          ...t.shadow.card,
        },
        style as any,
      ]}
    >
      {children}
    </View>
  );
}

