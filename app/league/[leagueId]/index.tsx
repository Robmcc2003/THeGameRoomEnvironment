// app/league/[leagueId]/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  TouchableOpacity,
  View as RNView,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { Text, View } from '../../../components/Themed';
import { useColorScheme } from '../../../components/useColorScheme';
import Colors from '../../../constants/Colors';

import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../FirebaseConfig';
import { listMembers, listInvites } from '../../../components/lib/members';

type LeagueDoc = {
  name: string;
  game?: string | null;
  ownerId: string;
  admins?: string[];
  createdAt?: any;
  updatedAt?: any;
  logoUrl?: string | null;
};

type MemberRow = {
  id: string;
  leagueId: string;
  userId: string;
  role?: 'member' | 'admin';
  status?: 'active' | 'invited' | 'pending';
  displayName?: string | null;
  photoURL?: string | null;
};

type InviteRow = {
  id: string;
  leagueId: string;
  emailLower: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedBy?: string;
  createdAt?: any;
};

// unified rows for the FlatList
type Row =
  | ({ kind: 'member' } & MemberRow)
  | ({ kind: 'invite' } & InviteRow);

export default function LeagueDetailScreen() {
  // robust param read
  const params = useLocalSearchParams();
  const leagueId =
    (Array.isArray(params.leagueId) ? params.leagueId[0] : (params.leagueId as string | undefined)) ??
    (Array.isArray((params as any).leagueID) ? (params as any).leagueID[0] : ((params as any).leagueID as string | undefined));

  const router = useRouter();

  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const tint = palette.tint;
  const cardBg = palette.card ?? (colorScheme === 'dark' ? '#16181A' : '#FFFFFF');
  const borderColor = palette.border ?? (colorScheme === 'dark' ? '#2A2D2F' : '#E6E6E6');

  const [loadingLeague, setLoadingLeague] = useState(true);
  const [league, setLeague] = useState<LeagueDoc | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const uid = auth.currentUser?.uid ?? null;
  const isOwner = !!(uid && league?.ownerId && uid === league.ownerId);
  const isAdmin = !!(uid && league?.admins && Array.isArray(league.admins) && league.admins.includes(uid));
  const canManageMembers = isOwner || isAdmin;

  const loadLeague = useCallback(async () => {
    if (!leagueId) { setLoadingLeague(false); return; }
    try {
      setLoadingLeague(true);
      const ref = doc(db, 'leagues', leagueId);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setLeague(null); router.back(); return; }
      setLeague(snap.data() as LeagueDoc);
    } catch (e) {
      console.error('Failed to load league', e);
    } finally {
      setLoadingLeague(false);
    }
  }, [leagueId, router]);

  // fetch members + invites and unify them
  const loadList = useCallback(async () => {
    if (!leagueId) { setLoadingList(false); setRefreshing(false); return; }
    try {
      setLoadingList(true);
      const [members, invites] = await Promise.all([listMembers(leagueId), listInvites(leagueId)]);

      const memberRows: Row[] = (members ?? []).map((m: any) => ({ kind: 'member', ...m }));
      const inviteRows: Row[] = (invites ?? []).map((i: any) => ({ kind: 'invite', ...i }));

      // sort: members first, then invites; within each, by name/email
      const unified = [...memberRows, ...inviteRows].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'member' ? -1 : 1;
        const aKey = a.kind === 'member' ? (a.displayName ?? a.userId ?? '') : a.emailLower;
        const bKey = b.kind === 'member' ? (b.displayName ?? b.userId ?? '') : b.emailLower;
        return aKey.localeCompare(bKey);
      });

      setRows(unified);
    } catch (e) {
      console.error('Failed to load list', e);
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, [leagueId]);

  useEffect(() => { loadLeague(); }, [loadLeague]);
  useEffect(() => { loadList(); }, [loadList]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadLeague(), loadList()]).finally(() => setRefreshing(false));
  };

  const goToAddMember = useCallback(() => {
    if (!leagueId) return;
    router.push({ pathname: '/league/[leagueId]/add-member', params: { leagueId: String(leagueId) } });
  }, [router, leagueId]);

  const ListHeader = useMemo(() => {
    if (!league) return null;
    return (
      <RNView style={{ padding: 20, gap: 16 }}>
        {/* Header card */}
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor, backgroundColor: cardBg, padding: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: '800' }}>{league.name}</Text>
          {league.game ? <Text style={{ marginTop: 4, opacity: 0.7 }}>{league.game}</Text> : null}
        </View>

        {/* Meta card */}
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor, backgroundColor: cardBg, padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Details</Text>
          <View style={{ gap: 6 }}>
            <Text><Text style={{ fontWeight: '700' }}>Owner: </Text><Text style={{ opacity: 0.8 }}>{league.ownerId}</Text></Text>
            {league.admins && league.admins.length > 0 ? (
              <RNView style={{ marginTop: 2 }}>
                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Admins</Text>
                <RNView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {league.admins.map((a, idx) => (
                    <View key={`${a}-${idx}`}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                        borderWidth: 1, borderColor,
                        backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                      }}>
                      <Text style={{ fontSize: 13 }}>{a}</Text>
                    </View>
                  ))}
                </RNView>
              </RNView>
            ) : null}
          </View>
        </View>

        {/* Members header row */}
        <RNView style={{ borderRadius: 14, borderWidth: 1, borderColor, backgroundColor: cardBg, padding: 16, paddingBottom: 8 }}>
          <RNView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>
              Members <Text style={{ opacity: 0.6, fontSize: 14 }}>({rows.filter(r => r.kind === 'member').length})</Text>
              {rows.some(r => r.kind === 'invite') ? (
                <Text style={{ opacity: 0.6, fontSize: 14 }}>{'  •  Invited '}{rows.filter(r => r.kind === 'invite').length}</Text>
              ) : null}
            </Text>
            {canManageMembers ? (
              <TouchableOpacity onPress={goToAddMember}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor }}>
                <Text style={{ fontWeight: '700' }}>Add member</Text>
              </TouchableOpacity>
            ) : null}
          </RNView>
          <RNView style={{ height: 12 }} />
        </RNView>
      </RNView>
    );
  }, [league, borderColor, cardBg, colorScheme, canManageMembers, goToAddMember, rows]);

  const renderRow: ListRenderItem<Row> = ({ item }) => {
    if (item.kind === 'member') {
      return (
        <RNView style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 12, backgroundColor: cardBg }}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            ) : (
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{item.displayName ?? item.userId}</Text>
              <Text style={{ opacity: 0.7, fontSize: 12 }}>{(item.role ?? 'member')} • {(item.status ?? 'active')}</Text>
            </View>
          </View>
          <RNView style={{ height: 8 }} />
        </RNView>
      );
    }

    // invite row
    return (
      <RNView style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 12, backgroundColor: cardBg }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '700' }}>✉️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{item.emailLower}</Text>
            <Text style={{ opacity: 0.7, fontSize: 12 }}>invited • {item.status}</Text>
          </View>
        </View>
        <RNView style={{ height: 8 }} />
      </RNView>
    );
  };

  if (!leagueId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ opacity: 0.8 }}>No league selected.</Text>
      </View>
    );
  }

  if (loadingLeague && !league) {
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
      <Stack.Screen
        options={{
          title: league.name,
          headerLargeTitle: true,
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () => (
            <RNView style={{ flexDirection: 'row' }}>
              {uid === league.ownerId ? (
                <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 6 }} onPress={() => router.push('../editleague')}>
                  <Text style={{ fontWeight: '700', color: tint }}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              {canManageMembers ? (
                <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 6 }} onPress={goToAddMember}>
                  <Text style={{ fontWeight: '700', color: tint }}>Add</Text>
                </TouchableOpacity>
              ) : null}
            </RNView>
          ),
        }}
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}_${item.id}`}
        renderItem={renderRow}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loadingList ? (
            <RNView style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={tint} />
              <Text style={{ marginTop: 8, opacity: 0.7 }}>Loading…</Text>
            </RNView>
          ) : (
            <RNView style={{ padding: 20, alignItems: 'center', gap: 8 }}>
              <Text style={{ opacity: 0.8 }}>No members or invites yet.</Text>
              {canManageMembers ? (
                <TouchableOpacity onPress={goToAddMember} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor }}>
                  <Text style={{ fontWeight: '700' }}>Add member</Text>
                </TouchableOpacity>
              ) : null}
            </RNView>
          )
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </>
  );
}
