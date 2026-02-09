// displaying the profile tab: user stats, tournament history, find friends, badges, and shooter stats. I use Firestore for data and RefreshControl for pull-to-refresh so it works just like most apps with a profile screen. 
// I also auto-award badges when the profile loads, so if an admin verifies a match win you can pull to refresh and see the new badge without needing to re-login or anything.
// Ref: Date toLocaleDateString - https://www.w3schools.com/jsref/jsref_tolocaledatestring.asp
// Ref: Array filter - https://www.w3schools.com/jsref/jsref_filter.asp
import { useFocusEffect, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { auth } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import { Text } from '../../components/Themed';
import { getUserOverallStats, getUserTournamentHistory, getUserGameSpecificStats } from '../../components/lib/tournaments';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';
import { getGameConfig } from '../../components/lib/gameTypes';
import { PublicUserSummary, searchUsers } from '../../components/lib/users';
import { AppBadge, AppButton, AppCard, AppInput, AchievementBadgeTile, useAppTheme } from '../../components/ui';
import { BADGES, ensureBadgesUpToDateForUser, getUserEarnedBadges } from '../../components/lib/badges';

type UserStats = {
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  overallWinRate: number;
  tournamentsParticipated: number;
  tournamentsWon: number;
};

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

export default function TabThreeScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#38383A' : '#E5E5EA';

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<TournamentHistoryItem[]>([]);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [shooterStats, setShooterStats] = useState<Record<string, number>>({});
  const [loadingShooterStats, setLoadingShooterStats] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendResults, setFriendResults] = useState<PublicUserSummary[]>([]);
  const [friendError, setFriendError] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<Record<string, any>>({});
  const [loadingBadges, setLoadingBadges] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = friendQuery.trim();

    if (q.length < 2) {
      setFriendResults([]);
      setFriendError(null);
      setFriendLoading(false);
      return;
    }

    setFriendLoading(true);
    setFriendError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(q, { limit: 12, excludeUserId: uid });
        if (!cancelled) setFriendResults(res);
      } catch (e: any) {
        if (!cancelled) setFriendError(e?.message ?? 'Search failed.');
      } finally {
        if (!cancelled) setFriendLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [friendQuery, uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      if (user) {
        // Get user display name
        const displayName = user.displayName || user.email?.split('@')[0] || 'Player';
        setUserDisplayName(displayName);
      }
    });
    return () => unsub();
  }, []);

  const loadProfileData = async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      const [statsData, historyData] = await Promise.all([
        getUserOverallStats(uid),
        getUserTournamentHistory(uid),
      ]);
      setStats(statsData);
      setHistory(historyData);
      
      // Load shooter game stats (Call of Duty)
      setLoadingShooterStats(true);
      try {
        const codStats = await getUserGameSpecificStats(uid, 'CALL_OF_DUTY');
        setShooterStats(codStats);
      } catch (error) {
        setShooterStats({});
      } finally {
        setLoadingShooterStats(false);
      }

      // Load and auto-award badges (best-effort)
      setLoadingBadges(true);
      try {
        const updated = await ensureBadgesUpToDateForUser(uid);
        setEarnedBadges(updated);
      } catch {
        // Fallback to read-only if awarding fails (e.g. rules)
        try {
          const onlyRead = await getUserEarnedBadges(uid);
          setEarnedBadges(onlyRead);
        } catch {
          setEarnedBadges({});
        }
      } finally {
        setLoadingBadges(false);
      }
    } catch {
      // I ignore load errors here and rely on existing state.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (uid) {
      loadProfileData();
    }
  }, [uid]);

  // rerun badge check when the profile tab is focused e.g. after an admin verifies a match
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      (async () => {
        try {
          const updated = await ensureBadgesUpToDateForUser(uid);
          setEarnedBadges(updated);
        } catch {
          try {
            const onlyRead = await getUserEarnedBadges(uid);
            setEarnedBadges(onlyRead);
          } catch {
            // Keep existing state.
          }
        }
      })();
    }, [uid])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProfileData();
  };

  /* Date formatting function (lines 96-108) uses JavaScript Date API - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date */
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Ongoing';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-GB', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return 'Unknown';
    }
  };

  const renderHistoryItem = ({ item }: { item: TournamentHistoryItem }) => (
    <TouchableOpacity
      style={[styles.historyCard, { backgroundColor: cardBg, borderColor }]}
      onPress={() => router.push({ pathname: '/league/[leagueId]/bracket', params: { leagueId: item.leagueId } })}
    >
      <View style={styles.historyHeader}>
        <Text style={[styles.historyTitle, { color: textColor }]}>{item.leagueName}</Text>
        {item.position && (
          <View style={[styles.positionBadge, { backgroundColor: tint }]}>
            <Text style={styles.positionText}>#{item.position}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.historyStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: '#666' }]}>Wins</Text>
          <Text style={[styles.statValue, { color: textColor }]}>{item.wins}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: '#666' }]}>Losses</Text>
          <Text style={[styles.statValue, { color: textColor }]}>{item.losses}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: '#666' }]}>Win Rate</Text>
          <Text style={[styles.statValue, { color: textColor }]}>
            {item.winRate.toFixed(1)}%
          </Text>
        </View>
      </View>
      
      <Text style={[styles.historyDate, { color: '#666' }]}>
        {item.completedAt 
          ? `Final Round Played: ${formatDate(item.completedAt)}` 
          : item.totalMatches > 0 
            ? 'In Progress' 
            : 'Not Started'}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tint} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Logo size="medium" showTagline={false} />
          <Text style={[styles.userName, { color: textColor }]}>{userDisplayName}</Text>
          <Text style={[styles.subtitle, { color: '#666' }]}>Your Tournament Profile</Text>
        </View>

        {/* Find friends */}
        <View style={{ marginHorizontal: 20, marginBottom: 24, zIndex: 1000, elevation: 10 }}>
          <AppCard>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Find friends</Text>
            <View style={{ position: 'relative' }}>
              <AppInput
                label="Search by username or display name"
                value={friendQuery}
                onChangeText={setFriendQuery}
                placeholder="Start typing to see suggestions..."
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Autocomplete suggestions dropdown */}
              {friendQuery.trim().length >= 2 && (
                <View
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    backgroundColor: cardBg,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: borderColor,
                    maxHeight: 300,
                    zIndex: 1001,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 10,
                  }}
                >
                {friendLoading ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator color={tint} size="small" />
                    <Text style={{ marginTop: 8, color: t.colors.mutedText, fontSize: 12 }}>
                      Searching...
                    </Text>
                  </View>
                ) : friendError ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontWeight: '700', color: '#FFC107', fontSize: 14 }}>{friendError}</Text>
                  </View>
                ) : friendResults.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ color: t.colors.mutedText, fontWeight: '600', fontSize: 14 }}>
                      No users found matching "{friendQuery}"
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: borderColor }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: t.colors.mutedText, letterSpacing: 0.5 }}>
                        SUGGESTIONS ({friendResults.length})
                      </Text>
                    </View>
                    {friendResults.map((u, idx) => {
                      const displayName = u.displayName || u.username || 'Player';
                      const username = u.username;
                      const queryLower = friendQuery.toLowerCase();
                      const highlightText = (text: string) => {
                        if (!text) return null;
                        const lower = text.toLowerCase();
                        const index = lower.indexOf(queryLower);
                        if (index === -1) {
                          return <Text style={{ fontWeight: '900', fontSize: 15, letterSpacing: 0.2, color: textColor }}>{text}</Text>;
                        }
                        return (
                          <Text style={{ fontWeight: '900', fontSize: 15, letterSpacing: 0.2, color: textColor }}>
                            {text.substring(0, index)}
                            <Text style={{ fontWeight: '900', color: tint, backgroundColor: tint + '20' }}>
                              {text.substring(index, index + queryLower.length)}
                            </Text>
                            {text.substring(index + queryLower.length)}
                          </Text>
                        );
                      };
                      const highlightUsername = (text: string) => {
                        if (!text) return null;
                        const lower = text.toLowerCase();
                        const index = lower.indexOf(queryLower);
                        if (index === -1) {
                          return <Text style={{ marginTop: 2, color: t.colors.mutedText, fontWeight: '700', fontSize: 13 }}>@{text}</Text>;
                        }
                        return (
                          <Text style={{ marginTop: 2, color: t.colors.mutedText, fontWeight: '700', fontSize: 13 }}>
                            @{text.substring(0, index)}
                            <Text style={{ fontWeight: '900', color: tint }}>{text.substring(index, index + queryLower.length)}</Text>
                            {text.substring(index + queryLower.length)}
                          </Text>
                        );
                      };
                      return (
                        <TouchableOpacity
                          key={u.id}
                          onPress={() => {
                            setFriendQuery('');
                            router.push({ pathname: '/user/[userId]' as any, params: { userId: u.id } as any });
                          }}
                          style={{
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            borderBottomWidth: idx < friendResults.length - 1 ? 1 : 0,
                            borderBottomColor: borderColor,
                            backgroundColor: 'transparent',
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {u.photoURL ? (
                              <View
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                  backgroundColor: tint + '20',
                                  overflow: 'hidden',
                                }}
                              >
                                {/* I reserve this area for a profile image when photoURL is present. */}
                              </View>
                            ) : (
                              <View
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 20,
                                  backgroundColor: tint + '20',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ fontWeight: '900', fontSize: 16, color: tint }}>
                                  {(displayName[0] || '?').toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              {highlightText(displayName)}
                              {username && highlightUsername(username)}
                            </View>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
            </View>
          </AppCard>
        </View>

        {/* Notifications shortcut */}
        <AppCard style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Notifications</Text>
          <Text style={{ marginTop: 6, color: t.colors.mutedText, fontWeight: '600' }}>
            View tournament updates sent by admins.
          </Text>
          <View style={{ marginTop: 14 }}>
            <AppButton
              title="Open inbox"
              variant="secondary"
              onPress={() => router.push('/notifications' as any)}
            />
          </View>
        </AppCard>

        {/* Overall Stats */}
        {stats && (
          <AppCard style={{ marginHorizontal: 20, marginBottom: 24 }}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Overall Statistics</Text>
            
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[styles.statCardValue, { color: tint }]}>{stats.totalWins}</Text>
                <Text style={[styles.statCardLabel, { color: '#666' }]}>Total Wins</Text>
              </View>
              
              <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[styles.statCardValue, { color: tint }]}>{stats.totalLosses}</Text>
                <Text style={[styles.statCardLabel, { color: '#666' }]}>Total Losses</Text>
              </View>
              
              <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[styles.statCardValue, { color: tint }]}>
                  {stats.overallWinRate.toFixed(1)}%
                </Text>
                <Text style={[styles.statCardLabel, { color: '#666' }]}>Win Rate</Text>
              </View>
              
              <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[styles.statCardValue, { color: tint }]}>{stats.totalMatches}</Text>
                <Text style={[styles.statCardLabel, { color: '#666' }]}>Total Matches</Text>
              </View>
              
              <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[styles.statCardValue, { color: tint }]}>
                  {stats.tournamentsParticipated}
                </Text>
                <Text style={[styles.statCardLabel, { color: '#666' }]}>Tournaments</Text>
              </View>
              
              <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                <Text style={[styles.statCardValue, { color: tint }]}>{stats.tournamentsWon}</Text>
                <Text style={[styles.statCardLabel, { color: '#666' }]}>Tournaments Won</Text>
              </View>
            </View>
          </AppCard>
        )}

        {/* Badges */}
        <AppCard style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>Badges</Text>
            <AppBadge
              text={`${Object.keys(earnedBadges || {}).length}/${BADGES.length}`}
              tone="tint"
            />
          </View>
          <Text style={{ marginTop: 6, color: t.colors.mutedText, fontWeight: '600' }}>
            Earn badges from verified matches and tournament wins.
          </Text>

          {loadingBadges ? (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <ActivityIndicator color={tint} />
            </View>
          ) : (
            <>
              {(['tournament', 'shooter', 'general'] as const).map((cat) => {
                const items = BADGES.filter(b => b.category === cat);
                const title =
                  cat === 'tournament' ? 'Tournament' : cat === 'shooter' ? 'Shooter' : 'General';
                return (
                  <View key={cat} style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 16, fontWeight: '900' }}>{title}</Text>
                      <Text style={{ color: t.colors.mutedText, fontWeight: '700' }}>
                        {items.filter(b => !!earnedBadges?.[b.id]).length}/{items.length}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16, gap: 16 }}>
                      {items.map((b) => (
                        <AchievementBadgeTile
                          key={b.id}
                          title={b.title}
                          description={b.description}
                          subtitle={earnedBadges?.[b.id] ? undefined : 'Locked'}
                          icon={b.icon as any}
                          rarity={b.rarity}
                          locked={!earnedBadges?.[b.id]}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </AppCard>

        {/* Shooter Game Stats (Call of Duty) */}
        {Object.keys(shooterStats).length > 0 && (
          <AppCard style={{ marginHorizontal: 20, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, { color: textColor, flex: 1 }]}>Shooter game stats</Text>
              <AppBadge text="CALL OF DUTY" tone="tint" />
            </View>
            
            <View style={styles.statsGrid}>
              {shooterStats.kills !== undefined && (
                <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                  <Text style={[styles.statCardValue, { color: tint }]}>{shooterStats.kills}</Text>
                  <Text style={[styles.statCardLabel, { color: '#666' }]}>Total Kills</Text>
                </View>
              )}
              
              {shooterStats.deaths !== undefined && (
                <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                  <Text style={[styles.statCardValue, { color: tint }]}>{shooterStats.deaths}</Text>
                  <Text style={[styles.statCardLabel, { color: '#666' }]}>Total Deaths</Text>
                </View>
              )}
              
              {shooterStats.kills !== undefined && shooterStats.deaths !== undefined && shooterStats.deaths > 0 && (
                <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                  <Text style={[styles.statCardValue, { color: tint }]}>
                    {(shooterStats.kills / shooterStats.deaths).toFixed(2)}
                  </Text>
                  <Text style={[styles.statCardLabel, { color: '#666' }]}>K/D Ratio</Text>
                </View>
              )}
              
              {shooterStats.objectives !== undefined && (
                <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
                  <Text style={[styles.statCardValue, { color: tint }]}>{shooterStats.objectives}</Text>
                  <Text style={[styles.statCardLabel, { color: '#666' }]}>Objectives</Text>
                </View>
              )}
            </View>
          </AppCard>
        )}

        {/* Tournament History */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Tournament History</Text>
          
          {history.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.emptyStateText, { color: '#666' }]}>
                No tournament history yet. Join a tournament to get started!
              </Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.leagueId}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    marginBottom: 20,
  },
  userName: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  statsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  statCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  historySection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  historyCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  positionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  positionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});
