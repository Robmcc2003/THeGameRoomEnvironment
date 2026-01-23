// Profile Tab Screen
// I display user statistics and tournament history.
/* Profile data fetching (lines 68-87) uses Firestore queries - https://firebase.google.com/docs/firestore/query-data/get-data */
/* RefreshControl from React Native - https://reactnative.dev/docs/refreshcontrol */
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { auth } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import { Text } from '../../components/Themed';
import { getUserOverallStats, getUserTournamentHistory } from '../../components/lib/tournaments';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

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
    } catch (error) {
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
      <SafeAreaView style={[styles.container, { backgroundColor: cardBg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tint} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: cardBg }]}>
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

        {/* Overall Stats */}
        {stats && (
          <View style={[styles.statsSection, { backgroundColor: cardBg, borderColor }]}>
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
          </View>
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
