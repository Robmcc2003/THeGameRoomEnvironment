import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, TouchableOpacity, View as RNView } from 'react-native';
import { Text, View } from '../../../components/Themed';
import Logo from '../../../components/Logo';
import { useColorScheme } from '../../../components/useColorScheme';
import Colors from '../../../constants/Colors';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../../FirebaseConfig';
import { getTournamentBracket, getTournamentStandings, Match } from '../../../components/lib/tournaments';

type LeagueDoc = {
  name: string;
  game?: string | null;
  ownerId: string;
  numberOfRounds?: number | null;
};

export default function TournamentBracketScreen() {
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
  const textColor = palette.text ?? '#1F1F1F';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [bracket, setBracket] = useState<{ matches: Match[]; rounds: number; currentRound: number } | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'bracket' | 'standings'>('standings');
  const [memberMap, setMemberMap] = useState<Record<string, { displayName?: string | null; userId: string }>>({});

  const uid = auth.currentUser?.uid ?? null;

  // Get current user's position in standings
  const userPosition = useMemo(() => {
    if (!uid || standings.length === 0) return null;
    const index = standings.findIndex(s => s.userId === uid);
    return index >= 0 ? index + 1 : null;
  }, [uid, standings]);

  // Get current user's stats
  const userStats = useMemo(() => {
    if (!uid || standings.length === 0) return null;
    return standings.find(s => s.userId === uid) || null;
  }, [uid, standings]);

  // Get current user's matches
  const userMatches = useMemo(() => {
    if (!uid || !bracket) return [];
    return bracket.matches.filter(
      m => m.player1Id === uid || m.player2Id === uid
    );
  }, [uid, bracket]);

  const loadLeague = useCallback(async () => {
    if (!leagueId) { setLoading(false); return; }
    try {
      const ref = doc(db, 'leagues', leagueId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setLeague(null);
        router.back();
        return;
      }
      setLeague(snap.data() as LeagueDoc);
    } catch (e) {
      console.error('Failed to load league', e);
    }
  }, [leagueId, router]);

  const loadMembers = useCallback(async () => {
    if (!leagueId) return;
    try {
      const membersQuery = query(
        collection(db, 'leagueMembers'),
        where('leagueId', '==', leagueId),
        where('status', '==', 'active')
      );
      const membersSnap = await getDocs(membersQuery);
      const map: Record<string, { displayName?: string | null; userId: string }> = {};
      membersSnap.docs.forEach(doc => {
        const data = doc.data();
        map[data.userId] = {
          displayName: data.displayName || null,
          userId: data.userId,
        };
      });
      setMemberMap(map);
    } catch (e) {
      console.error('Failed to load members', e);
    }
  }, [leagueId]);

  const loadBracket = useCallback(async () => {
    if (!leagueId) { setLoading(false); setRefreshing(false); return; }
    try {
      setLoading(true);
      const [bracketData, standingsData] = await Promise.all([
        getTournamentBracket(leagueId),
        getTournamentStandings(leagueId),
      ]);
      setBracket(bracketData);
      setStandings(standingsData);
      await loadMembers();
    } catch (e) {
      console.error('Failed to load bracket', e);
      Alert.alert('Error', 'Failed to load tournament bracket.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId, loadMembers]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  useEffect(() => {
    loadBracket();
  }, [loadBracket]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadLeague(), loadBracket()]).finally(() => setRefreshing(false));
  };

  const getPlayerName = (userId: string | null | undefined): string => {
    if (!userId) return 'TBD';
    const member = memberMap[userId];
    return member?.displayName || userId.substring(0, 8) + '...';
  };

  const renderMatch = (match: Match) => {
    const isCompleted = match.status === 'completed';
    const hasResult = match.result && match.result.winnerId;
    const isUserMatch = uid && (match.player1Id === uid || match.player2Id === uid);
    const player1Name = getPlayerName(match.player1Id);
    const player2Name = match.player2Id ? getPlayerName(match.player2Id) : null;

    return (
      <View
        key={match.id}
        style={{
          borderRadius: 16,
          borderWidth: 2,
          borderColor: isUserMatch ? tint : borderColor,
          backgroundColor: isUserMatch ? (colorScheme === 'dark' ? 'rgba(220,20,60,0.1)' : 'rgba(220,20,60,0.05)') : cardBg,
          padding: 18,
          marginBottom: 12,
          shadowColor: isUserMatch ? tint : '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isUserMatch ? 0.3 : 0.1,
          shadowRadius: 4,
          elevation: isUserMatch ? 5 : 3,
        }}
      >
        <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontSize: 12, opacity: 0.7 }}>
            Round {match.round} • Match {match.matchNumber}
          </Text>
          {isUserMatch && (
            <RNView style={{ backgroundColor: tint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>MY MATCH</Text>
            </RNView>
          )}
        </RNView>
        <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <RNView style={{ flex: 1 }}>
            <Text style={{ 
              fontWeight: hasResult && match.result?.winnerId === match.player1Id ? '800' : (match.player1Id === uid ? '700' : '400'),
              fontSize: 16,
              color: match.player1Id === uid ? tint : textColor,
            }}>
              {player1Name}
            </Text>
            {isCompleted && match.result?.player1Score !== undefined && (
              <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 4, fontWeight: '600' }}>
                Score: {match.result.player1Score}
              </Text>
            )}
          </RNView>
          <Text style={{ marginHorizontal: 12, opacity: 0.5, fontSize: 16, fontWeight: '600' }}>vs</Text>
          <RNView style={{ flex: 1, alignItems: 'flex-end' }}>
            {player2Name ? (
              <>
                <Text style={{ 
                  fontWeight: hasResult && match.result?.winnerId === match.player2Id ? '800' : (match.player2Id === uid ? '700' : '400'),
                  fontSize: 16,
                  color: match.player2Id === uid ? tint : textColor,
                }}>
                  {player2Name}
                </Text>
                {isCompleted && match.result?.player2Score !== undefined && (
                  <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 4, fontWeight: '600' }}>
                    Score: {match.result.player2Score}
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ opacity: 0.5, fontStyle: 'italic', fontSize: 16 }}>TBD</Text>
            )}
          </RNView>
        </RNView>
        <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <Text style={{ fontSize: 12, opacity: 0.6, fontWeight: '600' }}>
            Status: {match.status === 'completed' ? '✅ Completed' : match.status === 'in_progress' ? '🔄 In Progress' : '⏳ Pending'}
          </Text>
          {hasResult && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: tint }}>
              Winner: {getPlayerName(match.result?.winnerId)}
            </Text>
          )}
        </RNView>
      </View>
    );
  };

  const renderStandings = () => {
    if (standings.length === 0) {
      return (
        <RNView style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ opacity: 0.7, fontSize: 16 }}>No standings available yet.</Text>
        </RNView>
      );
    }

    return (
      <RNView style={{ padding: 16, gap: 12 }}>
        {standings.map((player, index) => (
          <View
            key={player.id}
            style={{
              borderRadius: 16,
              borderWidth: 2,
              borderColor,
              backgroundColor: cardBg,
              padding: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <RNView style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={{ 
                fontSize: 22, 
                fontWeight: '800', 
                marginRight: 16, 
                minWidth: 40, 
                color: index === 0 ? tint : (player.userId === uid ? tint : textColor) 
              }}>
                #{index + 1}
              </Text>
              <RNView style={{ flex: 1 }}>
                <Text style={{ 
                  fontWeight: player.userId === uid ? '800' : '700', 
                  fontSize: 16, 
                  letterSpacing: 0.3,
                  color: player.userId === uid ? tint : textColor,
                }}>
                  {player.displayName || player.userId}
                  {player.userId === uid && ' (You)'}
                </Text>
                <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 4, fontWeight: '600' }}>
                  {player.wins}W - {player.losses}L
                  {player.winRate > 0 && ` • ${player.winRate.toFixed(1)}% win rate`}
                </Text>
              </RNView>
            </RNView>
          </View>
        ))}
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

  if (loading && !league) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator color={tint} />
        <Text style={{ marginTop: 8, opacity: 0.7 }}>Loading tournament…</Text>
      </View>
    );
  }

  if (!league) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: league.name,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <RNView style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor, marginHorizontal: 20, marginBottom: 20 }}>
          <Logo size="small" showTagline={false} />
        </RNView>
        
        {/* View Mode Toggle */}
        <RNView
          style={{
            flexDirection: 'row',
            margin: 16,
            borderRadius: 12,
            borderWidth: 2,
            borderColor,
            backgroundColor: cardBg,
            padding: 4,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <TouchableOpacity
            onPress={() => setViewMode('standings')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: viewMode === 'standings' ? tint : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                color: viewMode === 'standings' ? '#fff' : textColor,
              }}
            >
              Standings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('bracket')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: viewMode === 'bracket' ? tint : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                color: viewMode === 'bracket' ? '#fff' : textColor,
              }}
            >
              Bracket
            </Text>
          </TouchableOpacity>
        </RNView>

        {/* Current User Status Card */}
        {uid && userStats && (
          <View style={{
            margin: 16,
            marginBottom: 8,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: tint,
            backgroundColor: colorScheme === 'dark' ? 'rgba(220,20,60,0.1)' : 'rgba(220,20,60,0.05)',
            padding: 18,
            shadowColor: tint,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: tint, marginBottom: 8, letterSpacing: 0.3 }}>
              Your Progress
            </Text>
            <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>
                Position: <Text style={{ color: tint, fontSize: 20 }}>#{userPosition}</Text>
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>
                {userStats.wins}W - {userStats.losses}L
              </Text>
            </RNView>
            {userStats.winRate > 0 && (
              <Text style={{ fontSize: 14, opacity: 0.7, fontWeight: '600' }}>
                Win Rate: {userStats.winRate.toFixed(1)}%
              </Text>
            )}
            {userMatches.length > 0 && (
              <Text style={{ fontSize: 14, opacity: 0.7, marginTop: 8, fontWeight: '600' }}>
                Your Matches: {userMatches.filter(m => m.status === 'pending').length} upcoming, {userMatches.filter(m => m.status === 'completed').length} completed
              </Text>
            )}
          </View>
        )}

        {viewMode === 'standings' ? (
          <>
            <Text style={{ fontSize: 24, fontWeight: '800', paddingHorizontal: 16, marginBottom: 16, letterSpacing: 0.5 }}>
              Leaderboard
            </Text>
            {loading ? (
              <RNView style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={tint} />
              </RNView>
            ) : (
              renderStandings()
            )}
          </>
        ) : (
          <>
            <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.5 }}>
                Tournament Bracket
              </Text>
              {userMatches.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    // Filter to show only user matches - we'll implement this with state
                    const filtered = bracket?.matches.filter(m => m.player1Id === uid || m.player2Id === uid) || [];
                    // For now, just scroll to first user match
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: tint,
                    borderWidth: 2,
                    borderColor: '#000000',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                    My Matches ({userMatches.length})
                  </Text>
                </TouchableOpacity>
              )}
            </RNView>
            {loading ? (
              <RNView style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={tint} />
              </RNView>
            ) : bracket && bracket.matches.length > 0 ? (
              <RNView style={{ padding: 16 }}>
                {/* Show user matches first if any */}
                {userMatches.length > 0 && (
                  <>
                    <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12, color: tint, letterSpacing: 0.3 }}>
                      Your Matches
                    </Text>
                    {userMatches.map(match => renderMatch(match))}
                    {bracket.matches.length > userMatches.length && (
                      <>
                        <Text style={{ fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 12, letterSpacing: 0.3 }}>
                          All Matches
                        </Text>
                        {bracket.matches.filter(m => !(m.player1Id === uid || m.player2Id === uid)).map(match => renderMatch(match))}
                      </>
                    )}
                  </>
                )}
                {userMatches.length === 0 && bracket.matches.map(match => renderMatch(match))}
              </RNView>
            ) : (
              <RNView style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ opacity: 0.7, fontSize: 16 }}>No matches scheduled yet.</Text>
              </RNView>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}


