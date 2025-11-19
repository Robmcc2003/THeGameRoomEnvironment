import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, View as RNView, RefreshControl, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { db } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import { Text as ThemedText, View } from '../../components/Themed';
import { joinTournament } from '../../components/lib/tournaments';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

type League = {
  id: string;
  name: string;
  game?: string | null;
  ownerId: string;
  description?: string | null;
  maxParticipants?: number | null;
  tournamentFormat?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
};

export default function TabTwoScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;
  
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const tint = palette.tint;
  const cardBg = palette.card ?? (colorScheme === 'dark' ? '#16181A' : '#FFFFFF');
  const borderColor = palette.border ?? (colorScheme === 'dark' ? '#2A2D2F' : '#E6E6E6');
  const textColor = palette.text ?? '#1F1F1F';

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [userMemberships, setUserMemberships] = useState<Set<string>>(new Set());

  // Fetch all leagues and check which ones the user has joined
  const fetchLeagues = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const leaguesQuery = query(collection(db, 'leagues'));
      const leaguesSnap = await getDocs(leaguesQuery);
      const allLeagues = leaguesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as League[];

      const membersQuery = query(
        collection(db, 'leagueMembers'),
        where('userId', '==', user.uid),
        where('status', '==', 'active')
      );
      const membersSnap = await getDocs(membersQuery);
      const membershipIds = new Set(membersSnap.docs.map(d => d.data().leagueId));

      setUserMemberships(membershipIds);
      setLeagues(allLeagues);
    } catch (error: any) {
      console.error('Failed to fetch leagues:', error);
      Alert.alert('Error', 'Failed to load leagues.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeagues();
  };

  const handleJoinLeague = async (leagueId: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be signed in to join a league.');
      return;
    }

    try {
      setJoiningId(leagueId);
      await joinTournament(leagueId);
      Alert.alert('Success!', 'You have joined the league.');
      await fetchLeagues();
    } catch (error: any) {
      Alert.alert('Could not join league', error?.message ?? 'Unknown error');
    } finally {
      setJoiningId(null);
    }
  };

  const handleViewLeague = (leagueId: string) => {
    router.push({
      pathname: '/league/[leagueId]',
      params: { leagueId },
    });
  };

  const renderLeague = ({ item }: { item: League }) => {
    const isMember = userMemberships.has(item.id);
    const isJoining = joiningId === item.id;

    return (
      <RNView style={styles.leagueCard}>
        <View
          style={{
            backgroundColor: cardBg,
            borderColor,
            borderWidth: 2,
            borderRadius: 16,
            padding: 20,
            gap: 12,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <RNView style={{ flex: 1, paddingRight: 12 }}>
              <ThemedText style={{ fontSize: 22, fontWeight: '800', color: textColor, letterSpacing: 0.3 }}>
                {item.name}
              </ThemedText>
              {item.game && (
                <ThemedText style={{ fontSize: 15, opacity: 0.7, marginTop: 6, color: textColor, fontWeight: '600' }}>
                  {item.game}
                </ThemedText>
              )}
            </RNView>
            {item.tournamentFormat && (
              <RNView
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: tint,
                  borderWidth: 2,
                  borderColor: '#000000',
                }}
              >
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF', textTransform: 'capitalize', letterSpacing: 0.5 }}>
                  {item.tournamentFormat.replace(/_/g, ' ')}
                </ThemedText>
              </RNView>
            )}
          </RNView>

          {item.description && (
            <ThemedText
              style={{ fontSize: 14, opacity: 0.8, lineHeight: 20, color: textColor }}
              numberOfLines={2}
            >
              {item.description}
            </ThemedText>
          )}

          <RNView style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            {item.maxParticipants && (
              <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ThemedText style={{ fontSize: 12, opacity: 0.6, color: textColor, fontWeight: '600' }}>
                  👥
                </ThemedText>
                <ThemedText style={{ fontSize: 12, opacity: 0.7, color: textColor, fontWeight: '600' }}>
                  Max {String(item.maxParticipants)}
                </ThemedText>
              </RNView>
            )}
            {item.startDate && (
              <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ThemedText style={{ fontSize: 12, opacity: 0.6, color: textColor, fontWeight: '600' }}>
                  📅
                </ThemedText>
                <ThemedText style={{ fontSize: 12, opacity: 0.7, color: textColor, fontWeight: '600' }}>
                  {item.startDate}
                </ThemedText>
              </RNView>
            )}
          </RNView>

          <RNView style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => handleViewLeague(item.id)}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 10,
                borderWidth: 2,
                borderColor,
                backgroundColor: 'transparent',
                alignItems: 'center',
              }}
            >
              <ThemedText style={{ fontWeight: '700', color: textColor, fontSize: 15 }}>View</ThemedText>
            </TouchableOpacity>
            
            {!isMember ? (
              <TouchableOpacity
                onPress={() => handleJoinLeague(item.id)}
                disabled={isJoining}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: tint,
                  alignItems: 'center',
                  opacity: isJoining ? 0.7 : 1,
                  borderWidth: 2,
                  borderColor: '#000000',
                  shadowColor: tint,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <ThemedText style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 15 }}>
                  {isJoining ? 'Joining...' : 'Join'}
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <RNView
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderWidth: 2,
                  borderColor,
                  alignItems: 'center',
                }}
              >
                <ThemedText style={{ fontWeight: '700', color: textColor, fontSize: 15 }}>Joined</ThemedText>
              </RNView>
            )}
          </RNView>
        </View>
      </RNView>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ThemedText style={styles.mainTitle}>Explore Leagues</ThemedText>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center', marginTop: 20 }}>
            Please sign in to explore and join leagues.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerSection}>
        <Logo size="medium" showTagline={true} />
      </View>
      
      {loading && leagues.length === 0 ? (
        <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <ActivityIndicator color={tint} size="large" />
          <ThemedText style={{ marginTop: 12, opacity: 0.7 }}>Loading leagues...</ThemedText>
        </RNView>
      ) : leagues.length === 0 ? (
        <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center' }}>
            No leagues available yet.
          </ThemedText>
        </RNView>
      ) : (
        <FlatList
          data={leagues}
          renderItem={renderLeague}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <ThemedText style={styles.mainTitle}>Explore Leagues</ThemedText>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />
          }
          ListEmptyComponent={
            <RNView style={{ padding: 20, alignItems: 'center' }}>
              <ThemedText style={{ opacity: 0.7 }}>No leagues found.</ThemedText>
            </RNView>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  headerSection: {
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  leagueCard: {
    marginBottom: 16,
  },
});
