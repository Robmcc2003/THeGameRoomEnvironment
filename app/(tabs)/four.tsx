// displaying the user's leagues with real-time Firestore listeners and allow creating new leagues and tournaments.
// Ref: Firestore real-time listener - https://firebase.google.com/docs/firestore/query-data/listen
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { Unsubscribe, addDoc, collection, doc, getDoc, onSnapshot as onDocSnapshot, onSnapshot, query,
  serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, ScrollView, TextInput, TouchableOpacity, View as RNView,
} from 'react-native';
import { auth, db } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import { Text, View } from '../../components/Themed';
import { styles } from '../../components/style.four';
import { getUserProgress } from '../../components/lib/tournaments';
import { GameType, getAvailableGameTypes } from '../../components/lib/gameTypes';
import { AppButton, AppCard, AppInput, useAppTheme } from '../../components/ui';
import { useColorScheme } from '../../components/useColorScheme';

type League = { 
  id: string;
  name: string;
  game?: string | null;
  gameType?: GameType | null;
  tournamentFormat?: 'normal_league' | 'single_elimination' | 'double_elimination' | 'round_robin' | null;
};

type LeagueProgress = {
  position: number | null;
  wins: number;
  losses: number;
  winRate: number;
  totalMatches: number;
  upcomingMatches: number;
  completedMatches: number;
};

export default function TabFourScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const colorScheme = (useColorScheme?.() ?? 'light') as 'light' | 'dark';

  const [leagueName, setLeagueName] = useState('');
  const [game, setGame] = useState('');
  const [gameType, setGameType] = useState<GameType | ''>('');
  const [tournamentType, setTournamentType] = useState<'league' | 'knockout' | 'round_robin' | ''>('');
  const [maxParticipants, setMaxParticipants] = useState<string>('');
  const [pointsPerWin, setPointsPerWin] = useState<string>('3');
  const [pointsPerDraw, setPointsPerDraw] = useState<string>('1');
  const [pointsPerLoss, setPointsPerLoss] = useState<string>('0');
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [leagueProgress, setLeagueProgress] = useState<Record<string, LeagueProgress | null>>({});
  const [loadingProgress, setLoadingProgress] = useState<Record<string, boolean>>({});
  
  const leagueUnsubsRef = useRef<Record<string, Unsubscribe>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const cleanupAllLeagueListeners = () => {
      Object.values(leagueUnsubsRef.current).forEach((unsub) => unsub?.());
      leagueUnsubsRef.current = {};
    };

    // If user is not signed in, clean up and exit without generating an error
    if (!uid) {
      cleanupAllLeagueListeners();
      setMyLeagues([]);
      setLoadingLeagues(false);
      return;
    }

    setLoadingLeagues(true);
    
    // Query to get all leagues where this user is a member
    const qy = query(collection(db, 'leagueMembers'), where('userId', '==', uid));
    
    // Real-time Membership Listener
    // onSnapshot() listens for changes to the query results.
    // Whenever the user joins or leaves a league, this fires.
    // Firestore real-time listeners: https://firebase.google.com/docs/firestore/query-data/listen
    const unsubscribeMemberships = onSnapshot(
      qy,
      (snap) => {
        // gathers all the league IDs the user is a member of
        const leagueIds = snap.docs.map((d) => d.data().leagueId as string);

        // If user has no leagues, clean up and exit
        if (leagueIds.length === 0) {
          cleanupAllLeagueListeners();
          setMyLeagues([]);
          setLoadingLeagues(false);
          return;
        }

        // Remove Listeners for Leagues that the user left
        // if a league ID is in my listeners but not in the current memberships,
        // the user left that league. I need to stop listening to it.
        Object.keys(leagueUnsubsRef.current).forEach((id) => {
          if (!leagueIds.includes(id)) {
            // Unsubscribe from this league's listener
            leagueUnsubsRef.current[id]?.();
            delete leagueUnsubsRef.current[id];
          }
        });

        // For each league the user is a member of, set up a real-time listener.
        // This listener will fire whenever the league data changes.
        leagueIds.forEach((id) => {
          // if I'm already listening to this league, move on
          if (leagueUnsubsRef.current[id]) return;

          // onDocSnapshot() listens for changes to a single document.
          // When the league is updated (name, game, etc.), this fires
          // Firestore document listeners: https://firebase.google.com/docs/firestore/query-data/listen#listen_to_multiple_documents_in_a_collection
          const unsub = onDocSnapshot(doc(db, 'leagues', id), (ld) => {
            // If league was deleted, remove it from the list
            if (!ld.exists()) {
              setMyLeagues((prev) => prev.filter((L) => L.id !== id));
              return;
            }

            // Get the league data
            const data = ld.data() as any;
            const updated = { 
              id: ld.id, 
              name: data.name, 
              game: data.game ?? null,
              gameType: data.gameType ?? null,
              tournamentFormat: data.tournamentFormat ?? null,
            } as League;

            // Update League in State
            // this either merges or replaces the league in the state array.
            // If it's new, I add it. If it exists, I update it.
            setMyLeagues((prev) => {
              const i = prev.findIndex((L) => L.id === id);
              if (i === -1) return [...prev, updated]; // Add new league
              const copy = [...prev];
              copy[i] = updated; // Update existing league
              return copy;
            });
            
            // Load progress for this league
            if (uid) {
              loadLeagueProgress(id, uid);
            }
            
            setLoadingLeagues(false);
          });

          // store the unsubscribe function so I can clean it up later
          leagueUnsubsRef.current[id] = unsub;
        });
      },
      (error) => {
        setLoadingLeagues(false);
      }
    );

    // When the component unmounts or the effect re-runs, it needs to:
    // 1. Stop listening to memberships
    // 2. Stop listening to all leagues
    // This prevents memory leaks
    return () => {
      unsubscribeMemberships();
      cleanupAllLeagueListeners();
    };
  }, [uid]); // Re-run when user ID changes

  // load progress for a specific league
  const loadLeagueProgress = async (leagueId: string, userId: string) => {
    if (loadingProgress[leagueId]) return; // Already loading
    
    try {
      setLoadingProgress(prev => ({ ...prev, [leagueId]: true }));
      const progress = await getUserProgress(leagueId, userId);
      setLeagueProgress(prev => ({ ...prev, [leagueId]: progress }));
    } catch (error) {
      setLeagueProgress(prev => ({ ...prev, [leagueId]: null }));
    } finally {
      setLoadingProgress(prev => ({ ...prev, [leagueId]: false }));
    }
  };

  // Handle Creating a New League
  // This function is called when the user submits the create league form.
  // It creates a new league document in Firestore and adds the user as the owner.
  // Firestore addDoc docs: https://firebase.google.com/docs/firestore/manage-data/add-data#add_a_document
  const handleCreateLeague = async () => {
    // Validate inputs
    if (!leagueName.trim()) {
      Alert.alert('Error', 'Please enter a league name');
      return;
    }

    if (!uid) {
      Alert.alert('Error', 'You must be signed in to create a league');
      return;
    }

    try {
      // Create new league doc in Firestore
      // addDoc() automatically generates a unique docID to identufy different leagues
      const leagueRef = await addDoc(collection(db, 'leagues'), {
        name: leagueName.trim(),
        game: game.trim() || null,
        gameType: gameType || null,
        ownerId: uid,
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp(),
      });

      // get user profile for display name
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const displayName = userData?.displayName || userData?.username || auth.currentUser?.email?.split('@')[0] || 'Player';
      const username = userData?.username || null;

      // add creator as a member of their league
      const memberId = `${leagueRef.id}_${uid}`;
      const memberRef = doc(db, 'leagueMembers', memberId);
      await setDoc(memberRef, {
        id: memberId,
        leagueId: leagueRef.id,
        userId: uid,
        role: 'member',
        status: 'active',
        displayName: displayName,
        username: username,
        joinedAt: serverTimestamp(),
        addedBy: uid,
      });

      // Clear the form
      setLeagueName('');
      setGame('');
      setGameType('');
      setTournamentType('');
      setMaxParticipants('');
      setPointsPerWin('3');
      setPointsPerDraw('1');
      setPointsPerLoss('0');

      // Navigates the user to the new league's detail page
      router.push({
        pathname: '/league/[leagueId]',
        params: { leagueId: leagueRef.id },
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create league: ' + (error?.message || 'Unknown error'));
    }
  };
  const tint = t.colors.tint;
  const cardBg = t.colors.card;
  const borderColor = t.colors.borderSubtle;
  const textColor = t.colors.text;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: t.colors.background }]}>
      <ScrollView style={[styles.container, { backgroundColor: t.colors.background }]}>
        <View style={styles.logoSection}>
          <Logo size="small" showTagline={false} />
        </View>

        <Text style={styles.mainTitle}>My Leagues</Text>

        <AppCard style={{ marginBottom: t.spacing.lg }}>
          <Text style={{ fontSize: 20, fontWeight: '900', letterSpacing: 0.3 }}>
            Create a tournament
          </Text>
          <Text style={{ marginTop: 6, color: t.colors.mutedText, fontWeight: '600' }}>
            Choose your tournament format and customize the settings.
          </Text>

          <RNView style={{ marginTop: t.spacing.lg, gap: t.spacing.md }}>
            <AppInput
              label="Tournament name"
              value={leagueName}
              onChangeText={setLeagueName}
              placeholder="Premier League, Champions Cup, etc."
              autoCapitalize="words"
            />
            <AppInput
              label="Game name (optional)"
              value={game}
              onChangeText={setGame}
              placeholder="FIFA, NBA 2K, Madden…"
              autoCapitalize="words"
            />

            {/* Tournament Type Selection */}
            <RNView>
              <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 10, color: textColor, letterSpacing: 0.2 }}>
                Tournament type *
              </Text>
              <RNView style={{ gap: 10 }}>
                {[
                  { id: 'league', name: '🏆 League', desc: 'Points-based (like Premier League). Everyone plays everyone, points determine standings.' },
                  { id: 'knockout', name: '🥊 Knockout', desc: 'Single elimination bracket. Lose once and you\'re out. Perfect for tournaments.' },
                  { id: 'round_robin', name: '🔄 Round Robin', desc: 'Everyone plays everyone once. Points-based standings, no elimination.' },
                ].map((type) => {
                  const selected = tournamentType === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      onPress={() => setTournamentType(selected ? '' : type.id as any)}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: selected ? tint : t.colors.borderStrong,
                        backgroundColor: selected ? (colorScheme === 'dark' ? tint + '20' : tint + '10') : t.colors.card,
                      }}
                    >
                      <Text style={{ fontWeight: '800', fontSize: 16, color: selected ? tint : textColor }}>
                        {type.name}
                      </Text>
                      <Text style={{ fontSize: 12, marginTop: 4, color: t.colors.mutedText, fontWeight: '600' }}>
                        {type.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </RNView>
            </RNView>

            {/* Game Type Selection */}
            <RNView>
              <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 10, color: textColor, letterSpacing: 0.2 }}>
                Game type (optional)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <RNView style={{ flexDirection: 'row', gap: 10, paddingBottom: 2 }}>
                  {getAvailableGameTypes().map((config) => {
                    const selected = gameType === config.id;
                    return (
                      <TouchableOpacity
                        key={config.id}
                        onPress={() => setGameType(selected ? '' : config.id)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: selected ? tint : t.colors.borderStrong,
                          backgroundColor: selected ? tint : t.colors.card,
                        }}
                      >
                        <Text style={{ fontWeight: '800', color: selected ? '#FFFFFF' : textColor }}>
                          {config.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </RNView>
              </ScrollView>
              {gameType ? (
                <Text style={{ fontSize: 12, marginTop: 10, color: t.colors.mutedText, fontWeight: '600' }}>
                  {getAvailableGameTypes().find(g => g.id === gameType)?.description}
                </Text>
              ) : null}
            </RNView>

            {/* Tournament-Specific Settings */}
            {tournamentType && (
              <RNView style={{ padding: 14, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F9F9F9', gap: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: textColor }}>
                  {tournamentType === 'league' ? '🏆 League Settings' : tournamentType === 'knockout' ? '🥊 Knockout Settings' : '🔄 Round Robin Settings'}
                </Text>

                {/* Max Participants */}
                <AppInput
                  label="Max participants (optional)"
                  value={maxParticipants}
                  onChangeText={setMaxParticipants}
                  placeholder={tournamentType === 'knockout' ? '8, 16, 32...' : 'Any number'}
                  keyboardType="numeric"
                />

                {/* Points System (for League and Round Robin) */}
                {(tournamentType === 'league' || tournamentType === 'round_robin') && (
                  <RNView style={{ gap: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: textColor }}>
                      Points system
                    </Text>
                    <RNView style={{ flexDirection: 'row', gap: 8 }}>
                      <RNView style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: t.colors.mutedText, marginBottom: 4 }}>Win</Text>
                        <TextInput
                          value={pointsPerWin}
                          onChangeText={setPointsPerWin}
                          keyboardType="numeric"
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: borderColor,
                            backgroundColor: cardBg,
                            color: textColor,
                            fontSize: 14,
                            fontWeight: '700',
                            textAlign: 'center',
                          }}
                        />
                      </RNView>
                      <RNView style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: t.colors.mutedText, marginBottom: 4 }}>Draw</Text>
                        <TextInput
                          value={pointsPerDraw}
                          onChangeText={setPointsPerDraw}
                          keyboardType="numeric"
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: borderColor,
                            backgroundColor: cardBg,
                            color: textColor,
                            fontSize: 14,
                            fontWeight: '700',
                            textAlign: 'center',
                          }}
                        />
                      </RNView>
                      <RNView style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: t.colors.mutedText, marginBottom: 4 }}>Loss</Text>
                        <TextInput
                          value={pointsPerLoss}
                          onChangeText={setPointsPerLoss}
                          keyboardType="numeric"
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: borderColor,
                            backgroundColor: cardBg,
                            color: textColor,
                            fontSize: 14,
                            fontWeight: '700',
                            textAlign: 'center',
                          }}
                        />
                      </RNView>
                    </RNView>
                    <Text style={{ fontSize: 11, color: t.colors.mutedText, fontStyle: 'italic' }}>
                      Default: 3 points for win, 1 for draw, 0 for loss
                    </Text>
                  </RNView>
                )}

                {/* Knockout-specific info */}
                {tournamentType === 'knockout' && (
                  <Text style={{ fontSize: 12, color: t.colors.mutedText, fontWeight: '600' }}>
                    💡 Tip: Choose a max participants count that's a power of 2 (8, 16, 32) for a clean bracket.
                  </Text>
                )}
              </RNView>
            )}

            <AppButton title="Create tournament" onPress={handleCreateLeague} />
          </RNView>
        </AppCard>

        <Text style={styles.sectionTitle}>My Leagues & Progress</Text>

        {loadingLeagues ? (
          <ActivityIndicator size="large" color="#DC143C" style={{ marginTop: 20 }} />
        ) : myLeagues.length === 0 ? (
          <Text style={styles.emptyText}>You haven't joined any leagues yet.</Text>
        ) : (
          <FlatList
            data={myLeagues}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const progress = leagueProgress[item.id];
              const isLoading = loadingProgress[item.id];
              const hasTournament = item.tournamentFormat && item.tournamentFormat !== 'normal_league';
              
              return (
                <TouchableOpacity
                  style={[
                    styles.leagueItem,
                    {
                      borderWidth: 2,
                      borderColor: progress && progress.position === 1 ? tint : borderColor,
                      backgroundColor: cardBg,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      shadowColor: progress && progress.position === 1 ? tint : '#000000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: progress && progress.position === 1 ? 0.3 : 0.1,
                      shadowRadius: 4,
                      elevation: progress && progress.position === 1 ? 5 : 3,
                    }
                  ]}
                  onPress={() => {
                    router.push({
                      pathname: '/league/[leagueId]',
                      params: { leagueId: item.id },
                    });
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.leagueName, { fontWeight: '800', fontSize: 18 }]}>{item.name}</Text>
                      {item.game && (
                        <Text style={[styles.leagueGame, { marginTop: 4, opacity: 0.7 }]}>{item.game}</Text>
                      )}
                      {hasTournament && (
                        <Text style={{ fontSize: 12, opacity: 0.6, marginTop: 4, textTransform: 'capitalize' }}>
                          {item.tournamentFormat?.replace(/_/g, ' ')}
                        </Text>
                      )}
                    </View>
                    {hasTournament && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push({
                            pathname: '/league/[leagueId]/bracket',
                            params: { leagueId: item.id },
                          });
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
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>View Bracket</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* Progress Section */}
                  {isLoading ? (
                    <View style={{ marginTop: 12, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={tint} />
                    </View>
                  ) : progress ? (
                    <View style={{ 
                      marginTop: 12, 
                      paddingTop: 12, 
                      borderTopWidth: 1, 
                      borderTopColor: borderColor,
                      opacity: 0.8,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        {progress.position !== null ? (
                          <Text style={{ fontSize: 16, fontWeight: '800', color: progress.position === 1 ? tint : textColor }}>
                            Rank: #{String(progress.position)}
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 14, fontWeight: '600', opacity: 0.7 }}>
                            No matches yet
                          </Text>
                        )}
                        {progress.totalMatches > 0 && (
                          <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>
                            {String(progress.wins)}W - {String(progress.losses)}L
                          </Text>
                        )}
                      </View>
                      {progress.totalMatches > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, opacity: 0.7, fontWeight: '600' }}>
                            Win Rate: {progress.winRate.toFixed(1)}%
                          </Text>
                          <Text style={{ fontSize: 13, opacity: 0.7, fontWeight: '600' }}>
                            {String(progress.upcomingMatches)} upcoming • {String(progress.completedMatches)} completed
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : hasTournament ? (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: borderColor }}>
                      <Text style={{ fontSize: 13, opacity: 0.6, fontStyle: 'italic' }}>
                        No tournament data available yet
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 
