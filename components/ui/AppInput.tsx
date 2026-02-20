import React from 'react';
import { TextInput, TextInputProps, View as RNView, ViewStyle } from 'react-native';
import { Text } from '../Themed';
import { useAppTheme } from './theme';

type Props = TextInputProps & {
  label?: string;
  containerStyle?: ViewStyle | ViewStyle[];
  hint?: string;
  error?: string;
};

// consistent input with optional label, hint and error
export function AppInput({ label, hint, error, containerStyle, style, ...rest }: Props) {
  const t = useAppTheme();
  const showError = !!error?.trim();

  return (
    <RNView style={[{ width: '100%' }, containerStyle as any]}>
      {label ? (
        <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 8, color: t.colors.text, letterSpacing: 0.2 }}>
          {label}
        </Text>
      ) : null}

      <TextInput
        {...rest}
        style={[
          {
            height: 52,
            borderWidth: t.borderWidth.regular,
            borderColor: showError ? t.colors.warning : t.colors.borderStrong,
            borderRadius: t.radius.md,
            paddingHorizontal: t.spacing.lg,
            fontSize: 16,
            fontWeight: '600',
            backgroundColor: t.colors.card,
            color: t.colors.text,
          },
          style as any,
        ]}
        placeholderTextColor={t.scheme === 'dark' ? 'rgba(255,255,255,0.45)' : '#999999'}
      />

      {showError ? (
        <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '700', color: t.colors.warning }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '600', color: t.colors.mutedText }}>
          {hint}
        </Text>
      ) : null}
    </RNView>
  );
}

