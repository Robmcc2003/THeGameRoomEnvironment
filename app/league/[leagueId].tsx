// app/league/[leagueId].tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { Text, View } from '../../components/Themed';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../FirebaseConfig';

type LeagueDoc = {
  name: string;
  game?: string | null;
  ownerId: string;
  admins?: string[];
  createdAt?: any;
  updatedAt?: any;
  logoUrl?: string | null;
};

export default function LeagueDetailScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();

  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const tint = palette.tint;
  const cardBg = palette.card ?? (colorScheme === 'dark' ? '#16181A' : '#FFFFFF');
  const borderColor = palette.border ?? (colorScheme === 'dark' ? '#2A2D2F' : '#E6E6E6');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [league, setLeague] = useState<LeagueDoc | null>(null);

  const load = useCallback(async () => {
    try {
      if (!leagueId) return;
      const ref = doc(db, 'leagues', String(leagueId));
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        router.back();
        return;
      }
      setLeague(snap.data() as LeagueDoc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const isOwner = auth.currentUser?.uid === league?.ownerId;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color={tint} />
        <Text style={{ marginTop: 8, opacity: 0.7 }}>Loading league…</Text>
      </View>
    );
  }

  if (!league) return null;

  return (
    <>
      {/* Header: dynamic title + owner-only Edit button */}
      <Stack.Screen
        options={{
          title: league.name,
          headerLargeTitle: true,
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () =>
            isOwner ? (
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                onPress={() =>
                  router.push({
                    pathname: '../league/editleague',
                    params: { leagueId: String(leagueId) },
                  })
                }
              >
                <Text style={{ fontWeight: '700', color: tint }}>Edit</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />}
      >
        {/* Header card */}
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor,
            backgroundColor: cardBg,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 26, fontWeight: '800' }}>{league.name}</Text>
          {league.game ? <Text style={{ marginTop: 4, opacity: 0.7 }}>{league.game}</Text> : null}
        </View>

        {/* Meta card */}
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor,
            backgroundColor: cardBg,
            padding: 16,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Details</Text>

          <View style={{ gap: 6 }}>
            <Text>
              <Text style={{ fontWeight: '700' }}>Owner: </Text>
              <Text style={{ opacity: 0.8 }}>{league.ownerId}</Text>
            </Text>

            {league.admins && league.admins.length > 0 ? (
              <View style={{ marginTop: 2 }}>
                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Admins</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {league.admins.map((a, idx) => (
                    <View
                      key={`${a}-${idx}`}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor,
                        backgroundColor:
                          colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                      }}
                    >
                      <Text style={{ fontSize: 13 }}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Next steps */}
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor,
            backgroundColor: cardBg,
            padding: 16,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700' }}>What’s next</Text>
          <Text style={{ opacity: 0.8 }}>
            This is your league hub. Next we’ll add members, invites, and fixtures.
          </Text>
          {isOwner ? (
            <Text style={{ opacity: 0.8 }}>
              You’re the owner — you’ll be able to edit settings and invite players.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
