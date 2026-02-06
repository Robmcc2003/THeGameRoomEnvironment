// I render a single achievement badge tile (icon, title, rarity, locked state) and show the description in an alert when pressed.
// Ref: Badge UI generation - https://chatgpt.com/share/69862ad5-9300-8007-9d95-100d9c6fc6b9
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useMemo } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useAppTheme } from './theme';
import type { BadgeRarity } from '../lib/badges';

// I map badge rarity to border/fill/glow colours.
function rarityColors(rarity: BadgeRarity) {
  switch (rarity) {
    case 'gold':
      return { border: '#D4AF37', fill: '#D4AF37', glow: '#D4AF37' };
    case 'bronze':
      return { border: '#CD7F32', fill: '#CD7F32', glow: '#CD7F32' };
    case 'silver':
    default:
      return { border: '#BFC7D5', fill: '#BFC7D5', glow: '#BFC7D5' };
  }
}

export function AchievementBadgeTile(props: {
  title: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  rarity: BadgeRarity;
  locked?: boolean;
  subtitle?: string;
  /** One-sentence hint on how to earn the badge; shown in a popup when the tile is pressed. */
  description?: string;
}) {
  const t = useAppTheme();
  const locked = !!props.locked;
  const colors = useMemo(() => rarityColors(props.rarity), [props.rarity]);

  const borderColor = locked ? t.colors.borderStrong : colors.border;
  const backgroundColor = locked ? '#0B0B0B' : colors.fill;
  const iconColor = locked ? t.colors.mutedText : '#FFFFFF';
  const labelColor = locked ? t.colors.mutedText : t.colors.text;

  const onPress = () => {
    if (props.description) {
      Alert.alert(props.title, props.description, [{ text: 'OK' }]);
    }
  };

  const content = (
    <>
      <View style={{ alignItems: 'center', position: 'relative' }}>
        <View
          style={{
            width: 74,
            height: 74,
            borderRadius: 16,
            borderWidth: 3,
            borderColor,
            backgroundColor,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: locked ? 'transparent' : colors.glow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <FontAwesome name={props.icon} size={30} color={iconColor} />
        </View>

        {locked ? (
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: t.colors.borderStrong,
              backgroundColor: '#0B0B0B',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FontAwesome name="lock" size={12} color={t.colors.mutedText as any} />
          </View>
        ) : null}
      </View>

      <Text
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontWeight: '900',
          fontSize: 12,
          letterSpacing: 0.2,
          color: labelColor as any,
        }}
        numberOfLines={2}
      >
        {props.title}
      </Text>
      {props.subtitle ? (
        <Text
          style={{
            marginTop: 6,
            textAlign: 'center',
            fontWeight: '700',
            fontSize: 11,
            color: t.colors.mutedText as any,
          }}
          numberOfLines={2}
        >
          {props.subtitle}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={{ width: '31%', marginBottom: 22 }}>
      {props.description ? (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

