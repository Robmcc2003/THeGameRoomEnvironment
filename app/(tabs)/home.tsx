// browse and join leagues; fetch from Firestore, render in a FlatList
// ref: Firestore get data - https://firebase.google.com/docs/firestore/query-data/get-data
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, View as RNView, RefreshControl, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { db } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import { Text as ThemedText, View } from '../../components/Themed';
import { joinTournament } from '../../components/lib/tournaments';
import { useColorScheme } from '../../components/useColorScheme';
import Colors from '../../constants/Colors';

// league shape from Firestore
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
  logoUrl?: string | null;
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

  // fetch all leagues and user memberships from Firestore
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

  // join league via tournaments library, update the UI on success
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

  // navigate to league detail
  const handleViewLeague = (leagueId: string) => {
    router.push({
      pathname: '/league/[leagueId]',
      params: { leagueId },
    });
  };

  const screenWidth = Dimensions.get('window').width;
  const cardGap = 12;
  const listPadding = 20;
  const cardWidth = (screenWidth - listPadding * 2 - cardGap) / 2;

  const renderLeague = ({ item }: { item: League }) => {
    const isMember = userMemberships.has(item.id);
    const isJoining = joiningId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleViewLeague(item.id)}
        style={[styles.leagueCard, { width: cardWidth, marginBottom: cardGap }]}
      >
        <View
          style={{
            backgroundColor: cardBg,
            borderColor,
            borderWidth: 2,
            borderRadius: 14,
            overflow: 'hidden',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <RNView style={{ width: cardWidth - 4, height: cardWidth * 0.85, backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#E8E8E8' }}>
            {item.logoUrl ? (
              <Image source={{ uri: item.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ThemedText style={{ fontSize: 32, opacity: 0.4 }}>🏆</ThemedText>
              </RNView>
            )}
          </RNView>
          <RNView style={{ padding: 10 }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: textColor, letterSpacing: 0.2 }} numberOfLines={2}>
              {item.name}
            </ThemedText>
            {!isMember ? (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleJoinLeague(item.id); }}
                disabled={isJoining}
                style={{
                  marginTop: 8,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: tint,
                  alignItems: 'center',
                  opacity: isJoining ? 0.7 : 1,
                  borderWidth: 2,
                  borderColor: '#000000',
                }}
              >
                <ThemedText style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 12 }}>
                  {isJoining ? 'Joining...' : 'Join'}
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: tint, marginTop: 6 }}>Joined</ThemedText>
            )}
          </RNView>
        </View>
      </TouchableOpacity>
    );
  };

  // show sign-in prompt when theres no user
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
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: cardGap, paddingHorizontal: listPadding }}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: 0 }]}
          ListHeaderComponent={
            <RNView style={{ paddingHorizontal: listPadding, marginBottom: 16 }}>
              <ThemedText style={styles.mainTitle}>Explore Leagues</ThemedText>
            </RNView>
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

// styles for explore leagues screen
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
    alignSelf: 'flex-start',
  },
});
