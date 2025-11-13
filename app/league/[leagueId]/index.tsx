
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Stack } from 'expo-router/stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ListRenderItem, View as RNView, TouchableOpacity,
} from 'react-native';
import { Text, View } from '../../../components/Themed';
import Logo from '../../../components/Logo';
import { useColorScheme } from '../../../components/useColorScheme';
import Colors from '../../../constants/Colors';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../FirebaseConfig';
import { deleteLeague } from '../../../components/lib/leagues';
import { cancelInvite, listInvites, listMembers, removeMember, resendInvite, setMemberRole,
} from '../../../components/lib/members';
import { joinTournament, getTournamentBracket, getTournamentStandings } from '../../../components/lib/tournaments';

type LeagueDoc = {
  name: string;
  game?: string | null;
  ownerId: string;
  admins?: string[];
  createdAt?: any;
  updatedAt?: any;
  logoUrl?: string | null;
  rules?: string | null;
  numberOfRounds?: number | null;
  maxParticipants?: number | null;
  startDate?: any;
  endDate?: any;
  tournamentFormat?: 'normal_league' | 'single_elimination' | 'double_elimination' | 'round_robin' | null;
  matchDuration?: number | null;
  prizeInfo?: string | null;
  registrationDeadline?: string | null;
  description?: string | null;
  scoringSystem?: string | null;
  tieBreakerRules?: string | null;
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
  resentAt?: any;
};
// two rows for listing current league members and also invited players
type Row =
  | ({ kind: 'member' } & MemberRow)
  | ({ kind: 'invite' } & InviteRow);
//function for the detail of league when clicked
export default function LeagueDetailScreen() {
  const params = useLocalSearchParams();
  const leagueId =
    (Array.isArray(params.leagueId) ? params.leagueId[0] : (params.leagueId as string | undefined)) ??
    (Array.isArray((params as any).leagueID) ? (params as any).leagueID[0] : ((params as any).leagueID as string | undefined));

  const router = useRouter();
  const navigation = useNavigation();
  
  // Handle back button
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)/four');
    }
  }, [router]);

// defining constants from colour schemes defined elsewhere
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const tint = palette.tint;
  const cardBg = palette.card ?? (colorScheme === 'dark' ? '#16181A' : '#FFFFFF');
  const borderColor = palette.border ?? (colorScheme === 'dark' ? '#2A2D2F' : '#E6E6E6');
  const textColor = palette.text ?? '#1F1F1F';

  const [loadingLeague, setLoadingLeague] = useState(true);
  const [league, setLeague] = useState<LeagueDoc | null>(null);
// handles the loading screen
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const uid = auth.currentUser?.uid ?? null;
  const isOwner = !!(uid && league?.ownerId && uid === league.ownerId);
  const isAdmin = !!(uid && league?.admins && Array.isArray(league.admins) && league.admins.includes(uid));
  const canManageMembers = isOwner || isAdmin;
  const isMember = !!(uid && rows.some(r => r.kind === 'member' && (r as MemberRow).userId === uid));

  const [deleting, setDeleting] = useState(false);
  const onDeleteLeague = useCallback(() => {
    if (!leagueId) return;
    Alert.alert(
      'Delete league?',
      'This will remove the league and all invites/members. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteLeague(String(leagueId));
              router.back();
            } catch (e: any) {
              Alert.alert('Could not delete league', e?.message ?? 'Unknown error');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [leagueId, router]);

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
  // referencehttps://www.w3schools.com/react/react_usecallback.asp
  // using usecallbacks throughout this so that functions dont reexecute unless dependanmcies change
  const loadList = useCallback(async () => {
    if (!leagueId) { setLoadingList(false); setRefreshing(false); return; }
    try {
      setLoadingList(true);
      const [membersData, invitesData] = await Promise.all([listMembers(leagueId), listInvites(leagueId)]);
      const memberRows: Row[] = (membersData ?? []).map((m: any) => ({ kind: 'member', ...m }));
      const inviteRows: Row[] = (invitesData ?? []).map((i: any) => ({ kind: 'invite', ...i }));
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
//  reference https://www.w3schools.com/react/react_useeffect.asp
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

  const goToBracket = useCallback(() => {
    if (!leagueId) return;
    router.push({ pathname: '/league/[leagueId]/bracket', params: { leagueId: String(leagueId) } });
  }, [router, leagueId]);

  const onJoinTournament = useCallback(async () => {
    if (!leagueId) return;
    try {
      setActioningId('join');
      await joinTournament(String(leagueId));
      Alert.alert(
        'Success!', 
        'You have joined the tournament. You can now view the bracket and track your progress.',
        [
          { text: 'View Bracket', onPress: () => router.push({ pathname: '/league/[leagueId]/bracket', params: { leagueId: String(leagueId) } }) },
          { text: 'OK' }
        ]
      );
      await loadList();
    } catch (e: any) {
      Alert.alert('Could not join tournament', e?.message ?? 'Unknown error');
    } finally {
      setActioningId(null);
    }
  }, [leagueId, loadList, router]);

  // ACTION HANDLERS 
  const onCancelInvite = async (emailLower: string) => {
    if (!leagueId) return;
    try {
      setActioningId(`invite:${emailLower}`);
      await cancelInvite(leagueId, emailLower);
      await loadList();
    } catch (e: any) {
      Alert.alert('Could not cancel invite', e?.message ?? 'Unknown error');
    } finally {
      setActioningId(null);
    }
  };

  const onResendInvite = async (emailLower: string) => {
    if (!leagueId) return;
    try {
      setActioningId(`invite:${emailLower}`);
      await resendInvite(leagueId, emailLower);
      await loadList();
      Alert.alert('Invite re-sent');
    } catch (e: any) {
      Alert.alert('Could not resend invite', e?.message ?? 'Unknown error');
    } finally {
      setActioningId(null);
    }
  };

  const onRemoveMember = async (userId: string) => {
    if (!leagueId) return;
    Alert.alert('Remove member?', 'This will remove them from the league.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setActioningId(`member:${userId}`);
            await removeMember(leagueId, userId);
            await loadList();
          } catch (e: any) {
            Alert.alert('Could not remove member', e?.message ?? 'Unknown error');
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  };

  const onToggleRole = async (userId: string, currentRole: 'member' | 'admin' | undefined) => {
    if (!leagueId) return;
    const nextRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      setActioningId(`member:${userId}`);
      await setMemberRole(leagueId, userId, nextRole);
      await loadList();
    } catch (e: any) {
      Alert.alert('Could not change role', e?.message ?? 'Unknown error');
    } finally {
      setActioningId(null);
    }
  };

  const ListHeader = useMemo(() => {
    if (!league) return null;
    return (
      <RNView style={{ padding: 20, gap: 16 }}>
        {/* Logo Section */}
        <RNView style={{ alignItems: 'center', marginBottom: 8 }}>
          <Logo size="small" showTagline={false} />
        </RNView>
        
        {/* Header card */}
        <View style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 20, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', letterSpacing: 0.5 }}>{league.name}</Text>
          {league.game ? <Text style={{ marginTop: 6, opacity: 0.7, fontSize: 16, fontWeight: '600' }}>{league.game}</Text> : null}
        </View>

        {/* Meta card */}
        <View style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 18, gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>Details</Text>
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

        {/* Tournament Settings card */}
        {(league.numberOfRounds || league.maxParticipants || league.rules || league.tournamentFormat || league.matchDuration) ? (
          <View style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 18, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>Tournament Settings</Text>
            <View style={{ gap: 8 }}>
              {league.tournamentFormat ? (
                <Text><Text style={{ fontWeight: '700' }}>Format: </Text><Text style={{ opacity: 0.8, textTransform: 'capitalize' }}>{league.tournamentFormat.replace(/_/g, ' ')}</Text></Text>
              ) : null}
              {league.numberOfRounds ? (
                <Text><Text style={{ fontWeight: '700' }}>Number of Rounds: </Text><Text style={{ opacity: 0.8 }}>{league.numberOfRounds}</Text></Text>
              ) : null}
              {league.maxParticipants ? (
                <Text><Text style={{ fontWeight: '700' }}>Max Participants: </Text><Text style={{ opacity: 0.8 }}>{league.maxParticipants}</Text></Text>
              ) : null}
              {league.matchDuration ? (
                <Text><Text style={{ fontWeight: '700' }}>Match Duration: </Text><Text style={{ opacity: 0.8 }}>{league.matchDuration} minutes</Text></Text>
              ) : null}
              {league.rules ? (
                <RNView style={{ marginTop: 4 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>Rules & Guidelines</Text>
                  <Text style={{ opacity: 0.8, lineHeight: 20 }}>{league.rules}</Text>
                </RNView>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Tournament Dates card */}
        {(league.registrationDeadline || league.startDate || league.endDate) ? (
          <View style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 18, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>Tournament Dates</Text>
            <View style={{ gap: 6 }}>
              {league.registrationDeadline ? (
                <Text><Text style={{ fontWeight: '700' }}>Registration Deadline: </Text><Text style={{ opacity: 0.8 }}>{league.registrationDeadline}</Text></Text>
              ) : null}
              {league.startDate ? (
                <Text><Text style={{ fontWeight: '700' }}>Start Date: </Text><Text style={{ opacity: 0.8 }}>{league.startDate}</Text></Text>
              ) : null}
              {league.endDate ? (
                <Text><Text style={{ fontWeight: '700' }}>End Date: </Text><Text style={{ opacity: 0.8 }}>{league.endDate}</Text></Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Match Settings card */}
        {(league.scoringSystem || league.tieBreakerRules) ? (
          <View style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 18, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>Match Settings</Text>
            <View style={{ gap: 8 }}>
              {league.scoringSystem ? (
                <RNView style={{ marginTop: 4 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>Scoring System</Text>
                  <Text style={{ opacity: 0.8, lineHeight: 20 }}>{league.scoringSystem}</Text>
                </RNView>
              ) : null}
              {league.tieBreakerRules ? (
                <RNView style={{ marginTop: 4 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>Tie-Breaker Rules</Text>
                  <Text style={{ opacity: 0.8, lineHeight: 20 }}>{league.tieBreakerRules}</Text>
                </RNView>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Additional Information card */}
        {(league.description || league.prizeInfo) ? (
          <View style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 18, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>Additional Information</Text>
            <View style={{ gap: 8 }}>
              {league.description ? (
                <RNView style={{ marginTop: 4 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>Description</Text>
                  <Text style={{ opacity: 0.8, lineHeight: 20 }}>{league.description}</Text>
                </RNView>
              ) : null}
              {league.prizeInfo ? (
                <RNView style={{ marginTop: 4 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>Prize Information</Text>
                  <Text style={{ opacity: 0.8, lineHeight: 20 }}>{league.prizeInfo}</Text>
                </RNView>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Join Tournament / View Bracket card */}
        <View style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 18, gap: 14 }}>
          <RNView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            {!isMember && uid ? (
              <TouchableOpacity
                onPress={onJoinTournament}
                disabled={!!actioningId}
                style={{
                  flex: 1,
                  minWidth: 120,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: tint,
                  alignItems: 'center',
                  opacity: actioningId === 'join' ? 0.7 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {actioningId === 'join' ? 'Joining...' : 'Join Tournament'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {isMember ? (
              <TouchableOpacity
                onPress={goToBracket}
                style={{
                  flex: 1,
                  minWidth: 120,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: tint,
                  backgroundColor: tint,
                  alignItems: 'center',
                  shadowColor: tint,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>View Bracket</Text>
              </TouchableOpacity>
            ) : null}
          </RNView>
        </View>

        {/* Members header row */}
        <RNView style={{ borderRadius: 16, borderWidth: 2, borderColor, backgroundColor: cardBg, padding: 18, paddingBottom: 10 }}>
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
  }, [league, borderColor, cardBg, colorScheme, canManageMembers, goToAddMember, rows, isMember, uid, tint, textColor, actioningId, onJoinTournament, goToBracket]);

  const ActionButton = ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!!disabled}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );

  const renderRow: ListRenderItem<Row> = ({ item }) => {
    if (item.kind === 'member') {
      const disabled = actioningId === `member:${item.userId}` || !canManageMembers;
      return (
        <RNView style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 2, borderColor, borderRadius: 16, backgroundColor: cardBg, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            ) : (
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{item.displayName ?? item.userId}</Text>
              <Text style={{ opacity: 0.7, fontSize: 12 }}>{(item.role ?? 'member')} • {(item.status ?? 'active')}</Text>
            </View>

            {canManageMembers ? (
              <RNView style={{ flexDirection: 'row', gap: 8 }}>
                <ActionButton
                  label={item.role === 'admin' ? 'Make member' : 'Make admin'}
                  onPress={() => onToggleRole(item.userId, item.role)}
                  disabled={disabled}
                />
                <ActionButton
                  label="Remove"
                  onPress={() => onRemoveMember(item.userId)}
                  disabled={disabled}
                />
              </RNView>
            ) : null}
          </View>
          <RNView style={{ height: 8 }} />
        </RNView>
      );
    }
    // invite row
    const disabled = actioningId === `invite:${item.emailLower}` || !canManageMembers;
    return (
      <RNView style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 2, borderColor, borderRadius: 16, backgroundColor: cardBg, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '700' }}>✉️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{item.emailLower}</Text>
            <Text style={{ opacity: 0.7, fontSize: 12 }}>invited • {item.status}</Text>
          </View>

          {canManageMembers ? (
            <RNView style={{ flexDirection: 'row', gap: 8 }}>
              <ActionButton label="Resend" onPress={() => onResendInvite(item.emailLower)} disabled={disabled} />
              <ActionButton label="Cancel" onPress={() => onCancelInvite(item.emailLower)} disabled={disabled} />
            </RNView>
          ) : null}
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
    headerLargeTitle: false,
    headerBackButtonDisplayMode: 'minimal',
    headerBackVisible: true,
    headerLeft: () => (
      <TouchableOpacity
        onPress={handleBack}
        style={{ paddingLeft: 16 }}
      >
        <Text style={{ fontSize: 17, color: tint, fontWeight: '600' }}>← Back</Text>
      </TouchableOpacity>
    ),
    headerRight: () => (
      <RNView style={{ flexDirection: 'row' }}>
        {uid === league.ownerId ? (
          <>
            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
              onPress={() => router.push({
                pathname: '/league/editleague',
                params: { leagueId: String(leagueId) },
              })}
            >
              <Text style={{ fontWeight: '700', color: tint }}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 6, opacity: deleting ? 0.5 : 1 }}
              disabled={deleting}
              onPress={onDeleteLeague}
            >
              <Text style={{ fontWeight: '700', color: '#ff3b30' /* iOS destructive red */ }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        {canManageMembers ? (
          <TouchableOpacity
            style={{ paddingHorizontal: 12, paddingVertical: 6, opacity: deleting ? 0.5 : 1 }}
            disabled={deleting}
            onPress={goToAddMember}
          >
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
