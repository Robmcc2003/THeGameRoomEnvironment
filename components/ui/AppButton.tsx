import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, TextStyle, ViewStyle } from 'react-native';
import { Text } from '../Themed';
import { useAppTheme } from './theme';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

// consistent button with theme colours
export function AppButton({ title, variant = 'primary', loading, disabled, style, textStyle, ...rest }: Props) {
  const t = useAppTheme();
  const isDisabled = !!disabled || !!loading;

  const bg =
    variant === 'primary' ? t.colors.tint : variant === 'danger' ? t.colors.danger : t.colors.card;
  const fg = variant === 'secondary' ? t.colors.text : '#FFFFFF';
  const borderColor =
    variant === 'secondary' ? t.colors.borderStrong : t.colors.borderStrong;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: t.radius.md,
          borderWidth: t.borderWidth.regular,
          borderColor,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: t.spacing.lg,
          opacity: isDisabled ? 0.7 : pressed ? 0.9 : 1,
          shadowColor: bg,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: variant === 'secondary' ? 0 : 0.28,
          shadowRadius: 8,
          elevation: variant === 'secondary' ? 0 : 5,
        },
        style as any,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[{ color: fg, fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }, textStyle as any]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

