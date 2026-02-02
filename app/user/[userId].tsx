// Public User Profile Screen
// I allow players to view each other's stats and tournament history.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, ScrollView, TouchableOpacity, View as RNView } from 'react-native';
import Logo from '../../components/Logo';
import { Text } from '../../components/Themed';
import { getPublicUserSummary } from '../../components/lib/users';
import { getUserGameSpecificStats, getUserOverallStats, getUserTournamentHistory } from '../../components/lib/tournaments';
import { AppBadge, AppCard, useAppTheme } from '../../components/ui';

type TournamentHistoryItem = {
  leagueId: string;
  leagueName: string;
  format: string;
  position: number | null;
  wins: number;
  losses: number;
  winRate: number;
  totalMatches: number;
  completedAt?: any;
  joinedAt?: any;
};

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const t = useAppTheme();

  const id = useMemo(() => (Array.isArray(userId) ? userId[0] : userId) ?? '', [userId]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<{ displayName?: string | null; username?: string | null } | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [history, setHistory] = useState<TournamentHistoryItem[]>([]);
  const [shooterStats, setShooterStats] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [summary, overall, hist, cod] = await Promise.all([
        getPublicUserSummary(id),
        getUserOverallStats(id),
        getUserTournamentHistory(id),
        getUserGameSpecificStats(id, 'CALL_OF_DUTY'),
      ]);

      setProfile(summary ? { displayName: summary.displayName, username: summary.username } : null);
      setStats(overall);
      setHistory(hist as any);
      setShooterStats(cod || {});
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Ongoing';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  const renderHistoryItem = ({ item }: { item: TournamentHistoryItem }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/league/[leagueId]/bracket', params: { leagueId: item.leagueId } })}
      style={{
        borderRadius: 12,
        borderWidth: 2,
        borderColor: t.colors.borderStrong,
        backgroundColor: t.colors.card,
        padding: 16,
      }}
    >
      <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '900', flex: 1 }}>{item.leagueName}</Text>
        {item.position ? <AppBadge text={`#${String(item.position)}`} tone="tint" /> : null}
      </RNView>

      <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
        <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>W {String(item.wins)}</Text>
        <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>L {String(item.losses)}</Text>
        <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>{item.winRate.toFixed(1)}%</Text>
      </RNView>

      <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '600' }}>
        {item.completedAt ? `Final: ${formatDate(item.completedAt)}` : item.totalMatches > 0 ? 'In progress' : 'Not started'}
      </Text>
    </TouchableOpacity>
  );

  const title = profile?.displayName || (profile?.username ? `@${profile.username}` : 'Player');

  return (
    <>
      <Stack.Screen options={{ title, headerBackVisible: true, headerBackButtonDisplayMode: 'minimal' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.tint} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
        >
          <RNView style={{ alignItems: 'center', marginBottom: 4 }}>
            <Logo size="small" showTagline={false} />
          </RNView>

          {loading ? (
            <RNView style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator color={t.colors.tint} />
              <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '700' }}>Loading…</Text>
            </RNView>
          ) : !profile ? (
            <AppCard>
              <Text style={{ fontSize: 18, fontWeight: '900' }}>User not found</Text>
              <Text style={{ marginTop: 8, color: t.colors.mutedText, fontWeight: '600' }}>
                This profile might not be public, or the user no longer exists.
              </Text>
            </AppCard>
          ) : (
            <>
              <AppCard>
                <Text style={{ fontSize: 24, fontWeight: '900', letterSpacing: 0.3 }}>{profile.displayName || 'Player'}</Text>
                {profile.username ? (
                  <Text style={{ marginTop: 6, color: t.colors.mutedText, fontWeight: '800' }}>@{profile.username}</Text>
                ) : null}
              </AppCard>

              {stats ? (
                <AppCard>
                  <Text style={{ fontSize: 20, fontWeight: '900' }}>Overall statistics</Text>
                  <RNView style={{ marginTop: 14, gap: 8 }}>
                    <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Wins: {String(stats.totalWins)}</Text>
                    <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Losses: {String(stats.totalLosses)}</Text>
                    <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Win rate: {Number(stats.overallWinRate).toFixed(1)}%</Text>
                    <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Matches: {String(stats.totalMatches)}</Text>
                    <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Tournaments: {String(stats.tournamentsParticipated)}</Text>
                    <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Tournaments won: {String(stats.tournamentsWon)}</Text>
                  </RNView>
                </AppCard>
              ) : null}

              {Object.keys(shooterStats).length > 0 ? (
                <AppCard>
                  <RNView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 20, fontWeight: '900' }}>Shooter game stats</Text>
                    <AppBadge text="CALL OF DUTY" tone="tint" />
                  </RNView>

                  <RNView style={{ marginTop: 14, gap: 8 }}>
                    {shooterStats.kills !== undefined ? (
                      <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Kills: {String(shooterStats.kills)}</Text>
                    ) : null}
                    {shooterStats.deaths !== undefined ? (
                      <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Deaths: {String(shooterStats.deaths)}</Text>
                    ) : null}
                    {shooterStats.kills !== undefined && shooterStats.deaths !== undefined && shooterStats.deaths > 0 ? (
                      <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>
                        K/D: {(shooterStats.kills / shooterStats.deaths).toFixed(2)}
                      </Text>
                    ) : null}
                    {shooterStats.objectives !== undefined ? (
                      <Text style={{ fontWeight: '700', color: t.colors.mutedText }}>Objectives: {String(shooterStats.objectives)}</Text>
                    ) : null}
                  </RNView>
                </AppCard>
              ) : null}

              <AppCard>
                <Text style={{ fontSize: 20, fontWeight: '900' }}>Tournament history</Text>
                {history.length === 0 ? (
                  <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '600' }}>
                    No tournament history yet.
                  </Text>
                ) : (
                  <RNView style={{ marginTop: 14 }}>
                    <FlatList
                      data={history}
                      renderItem={renderHistoryItem}
                      keyExtractor={(item) => item.leagueId}
                      scrollEnabled={false}
                      ItemSeparatorComponent={() => <RNView style={{ height: 12 }} />}
                    />
                  </RNView>
                )}
              </AppCard>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

