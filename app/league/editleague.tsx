// app/league/[leagueId]/edit.tsx
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { Text, View } from '../../components/Themed';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

import { auth, db } from '../../FirebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function EditLeagueScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();

  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const tint = palette.tint;

  // local fallbacks so we don’t need extra tokens
  const cardBg = palette.card ?? (scheme === 'dark' ? '#16181A' : '#FFFFFF');
  const borderColor = palette.border ?? (scheme === 'dark' ? '#2A2D2F' : '#E6E6E6');
  const textColor = palette.text ?? '#1F1F1F';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [game, setGame] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, 'leagues', String(leagueId));
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          Alert.alert('Not found', 'This league no longer exists.');
          router.back();
          return;
        }
        const data = snap.data() as any;

        // client-side guard (we’ll enforce with Firestore rules later)
        if (auth.currentUser?.uid !== data.ownerId) {
          Alert.alert('No access', 'Only the owner can edit this league.');
          router.back();
          return;
        }

        setName(data.name ?? '');
        setGame(data.game ?? '');
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load league.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [leagueId]);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'League name is required.');
      return;
    }
    try {
      setSaving(true);
      const ref = doc(db, 'leagues', String(leagueId));
      await updateDoc(ref, {
        name: name.trim(),
        game: game.trim() || null,
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Saved', 'League updated.');
      router.back();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color={tint} />
        <Text style={{ marginTop: 8, opacity: 0.7 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit League',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <View style={{ padding: 20, gap: 14 }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderColor,
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              gap: 12,
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 16, color: textColor }}>
              League name
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 8,
                paddingHorizontal: 12,
                height: 44,
              }}
              value={name}
              onChangeText={setName}
              placeholder="Enter league name"
              placeholderTextColor="#9AA0A6"
            />

            <Text style={{ marginTop: 8, fontWeight: '700', fontSize: 16, color: textColor }}>
              Game
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor,
                backgroundColor: cardBg,
                color: textColor,
                borderRadius: 8,
                paddingHorizontal: 12,
                height: 44,
              }}
              value={game}
              onChangeText={setGame}
              placeholder="FIFA, NBA 2K, Madden…"
              placeholderTextColor="#9AA0A6"
            />
          </View>

          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            style={{
              backgroundColor: tint,
              height: 48,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
