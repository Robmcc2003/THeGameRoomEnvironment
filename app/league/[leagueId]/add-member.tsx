
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addMemberToLeague } from '../../../components/lib/members';

export default function AddMemberScreen() {
  // read leagueId (handles string | string[]; legacy leagueID fallback for fear of errors)
  const params = useLocalSearchParams();
  const leagueId =
    (Array.isArray(params.leagueId) ? params.leagueId[0] : (params.leagueId as string | undefined)) ??
    (Array.isArray((params as any).leagueID) ? (params as any).leagueID[0] : ((params as any).leagueID as string | undefined));

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onAdd = async () => {
    const e = email.trim().toLowerCase();

    if (!leagueId) return Alert.alert('Missing league id');
    if (!e) return Alert.alert('Please enter an email');
    //very light email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return Alert.alert('Enter a valid email');

    try {
      setBusy(true);
      const res = await addMemberToLeague({ leagueId, email: e });

      if (res.kind === 'added') {
        Alert.alert('Member added', 'Congrats! The user has been added to this league.');
      } else {
        Alert.alert(
          'Invite created',
          'Bad news 😢, We cant find this member just yet but we have saved their details!'
        );
      }
      router.back(); // return to league page
    } catch (err: any) {
      Alert.alert('Could not add member', err?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '600', marginBottom: 8 }}>Add Member</Text>

      {!leagueId ? (
        <Text style={{ opacity: 0.7 }}>
          No league selected. Try navigating here from a league’s page.
        </Text>
      ) : null}

      <Text style={{ fontSize: 14, opacity: 0.8 }}>
        Enter the user’s email. If they haven’t created a profile yet, we’ll add a pending invite.
      </Text>

      <TextInput
        placeholder="friend@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 10,
          padding: 12,
          backgroundColor: busy ? '#f3f3f3' : 'white',
        }}
      />

      <Pressable
        onPress={onAdd}
        disabled={busy}
        style={{
          backgroundColor: busy ? '#999' : '#0a84ff',
          padding: 14,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        {busy ? <ActivityIndicator /> : <Text style={{ color: 'white', fontWeight: '700' }}>Add Member</Text>}
      </Pressable>
    </View>
  );
}
