// modal grid of Bottts Neutral avatars for profile picker
import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../Themed';
import { useAppTheme } from './theme';
import { AVATAR_OPTIONS, getAvatarImageUrl, type AvatarOption } from '../lib/avatars';

type Props = {
  visible: boolean;
  selectedAvatarId: string | null;
  onSelect: (avatarId: string) => void;
  onClose: () => void;
};

const AVATAR_SIZE = 72;
const COLS = 3;
const GAP = 12;

export function AvatarPicker({ visible, selectedAvatarId, onSelect, onClose }: Props) {
  const t = useAppTheme();
  const { width } = useWindowDimensions();
  const padding = 20;
  const availableWidth = width - padding * 2;
  const size = Math.min(AVATAR_SIZE, (availableWidth - (COLS - 1) * GAP) / COLS);

  const renderOption = (opt: AvatarOption) => {
    const url = getAvatarImageUrl(opt.id);
    const selected = selectedAvatarId === opt.id;
    return (
      <TouchableOpacity
        key={opt.id}
        onPress={() => onSelect(opt.id)}
        activeOpacity={0.8}
        style={[
          styles.avatarWrap,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: selected ? 4 : 2,
            borderColor: selected ? t.colors.tint : t.colors.borderStrong,
            backgroundColor: t.colors.card,
          },
        ]}
      >
        {url ? (
          <Image source={{ uri: url }} style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={{ fontWeight: '800', color: t.colors.mutedText }}>?</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        activeOpacity={1}
        style={styles.backdrop}
        onPress={onClose}
      >
        <View
          style={[styles.content, { backgroundColor: t.colors.background, borderColor: t.colors.borderStrong }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={[styles.title, { color: t.colors.text }]}>Choose your avatar</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={{ fontWeight: '800', color: t.colors.tint }}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ marginBottom: 16, color: t.colors.mutedText, fontWeight: '600', fontSize: 14 }}>
            Tap an avatar to use it on your profile.
          </Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {AVATAR_OPTIONS.map(renderOption)}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  scroll: {
    maxHeight: 320,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'space-between',
  },
  avatarWrap: {
    overflow: 'hidden',
  },
  avatarImg: {
    backgroundColor: 'transparent',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
