// user leagues with real-time Firestore listeners; create new leagues and tournaments
// ref: Firestore listen - https://firebase.google.com/docs/firestore/query-data/listen
// ref: Fancy carousel - https://reactnativecomponents.com/components/walkthrough/fancy-carousel
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { Unsubscribe, addDoc, collection, doc, getDoc, onSnapshot as onDocSnapshot, onSnapshot, query,
  serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, SafeAreaView, ScrollView, TextInput, TouchableOpacity, View as RNView,
} from 'react-native';
import { auth, db } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import { Text, View } from '../../components/Themed';
import { styles } from '../../components/style.four';
import { getUserProgress, autoGenerateBracketIfNeeded, generateRoundRobinFixtures, createEmptyBracketStructure } from '../../components/lib/tournaments';
import { GameType, getAvailableGameTypes } from '../../components/lib/gameTypes';
import { uploadLeagueImage, updateLeagueImageUrl } from '../../components/lib/leagues';
import { AppButton, AppCard, AppInput, useAppTheme, WalkthroughCarousel } from '../../components/ui';
import { useColorScheme } from '../../components/useColorScheme';

type League = { 
  id: string;
  name: string;
  game?: string | null;
  gameType?: GameType | null;
  tournamentFormat?: 'normal_league' | 'single_elimination' | 'double_elimination' | 'round_robin' | null;
  logoUrl?: string | null;
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
  const [leagueImageBase64, setLeagueImageBase64] = useState<string | null>(null);

  // store per-league listeners for cleanup
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

    // no user: clean up listeners and exit
    if (!uid) {
      cleanupAllLeagueListeners();
      setMyLeagues([]);
      setLoadingLeagues(false);
      return;
    }

    setLoadingLeagues(true);
    
    // query leagues where user is a member
    const qy = query(collection(db, 'leagueMembers'), where('userId', '==', uid));
    
    // real-time membership listener: fires when user joins or leaves a league
    const unsubscribeMemberships = onSnapshot(
      qy,
      (snap) => {
        // gather all league IDs user is member of
        const leagueIds = snap.docs.map((d) => d.data().leagueId as string);

        // no leagues: clean up and exit
        if (leagueIds.length === 0) {
          cleanupAllLeagueListeners();
          setMyLeagues([]);
          setLoadingLeagues(false);
          return;
        }

        // remove listeners for leagues user has left
        Object.keys(leagueUnsubsRef.current).forEach((id) => {
          if (!leagueIds.includes(id)) {
            // unsubscribe from this league
            leagueUnsubsRef.current[id]?.();
            delete leagueUnsubsRef.current[id];
          }
        });

        // set up real-time listener for each league
        leagueIds.forEach((id) => {
          // skip if already listening
          if (leagueUnsubsRef.current[id]) return;

          // listen for changes to league document (name, game, etc.)
          const unsub = onDocSnapshot(doc(db, 'leagues', id), (ld) => {
            // league deleted: remove from list
            if (!ld.exists()) {
              setMyLeagues((prev) => prev.filter((L) => L.id !== id));
              return;
            }

            // get league data
            const data = ld.data() as any;
            const updated = { 
              id: ld.id, 
              name: data.name, 
              game: data.game ?? null,
              gameType: data.gameType ?? null,
              tournamentFormat: data.tournamentFormat ?? null,
              logoUrl: data.logoUrl ?? null,
            } as League;

            // merge or replace league in state
            setMyLeagues((prev) => {
              const i = prev.findIndex((L) => L.id === id);
              if (i === -1) return [...prev, updated]; // Add new league
              const copy = [...prev];
              copy[i] = updated; // Update existing league
              return copy;
            });
            
            // load progress for this league
            if (uid) {
              loadLeagueProgress(id, uid);
            }
            
            setLoadingLeagues(false);
          });

          // store unsubscribe for cleanup
          leagueUnsubsRef.current[id] = unsub;
        });
      },
      (error) => {
        setLoadingLeagues(false);
      }
    );

    // on unmount: stop all listeners to prevent memory leaks
    return () => {
      unsubscribeMemberships();
      cleanupAllLeagueListeners();
    };
  }, [uid]);

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

  // create new league on form submit, add user as owner
  const handleCreateLeague = async () => {
    // validate inputs
    if (!leagueName.trim()) {
      Alert.alert('Error', 'Please enter a league name');
      return;
    }

    if (!uid) {
      Alert.alert('Error', 'You must be signed in to create a league');
      return;
    }

    if (!tournamentType) {
      Alert.alert('Error', 'Please select a tournament type');
      return;
    }

    try {
      // Map tournament type to tournamentFormat
      const tournamentFormat = 
        tournamentType === 'league' ? 'normal_league' :
        tournamentType === 'knockout' ? 'single_elimination' :
        tournamentType === 'round_robin' ? 'round_robin' :
        null;

      // create league doc (addDoc generates unique id)
      const leagueRef = await addDoc(collection(db, 'leagues'), {
        name: leagueName.trim(),
        game: game.trim() || null,
        gameType: gameType || null,
        tournamentFormat: tournamentFormat,
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : null,
        ownerId: uid,
        logoUrl: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (leagueImageBase64) {
        try {
          const logoUrl = await uploadLeagueImage(leagueRef.id, leagueImageBase64);
          await updateLeagueImageUrl(leagueRef.id, logoUrl);
        } catch (imgErr: any) {
          // league created; image upload failed (non-blocking)
          Alert.alert('League created', 'Cover image could not be uploaded. You can add one from the league page.');
        }
      }

      // get user profile for display name
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const displayName = userData?.displayName || userData?.username || auth.currentUser?.email?.split('@')[0] || 'Player';
      const username = userData?.username || null;

      // add creator as league member
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

      // initialise tournament structure by format
      if (tournamentFormat === 'single_elimination') {
        // knockout: create empty bracket structure
        try {
          await createEmptyBracketStructure(leagueRef.id);
        } catch (err) {
          // fallback: auto-generate if 2+ members
          try {
            await autoGenerateBracketIfNeeded(leagueRef.id);
          } catch {
            // bracket will generate when members join
          }
        }
      } else if (tournamentFormat === 'round_robin') {
        // round robin: generate fixtures when 2+ members
        try {
          await generateRoundRobinFixtures(leagueRef.id);
        } catch {
          // fixtures will generate when members join
        }
      }
      // normal league: standings from matches

      // clear form
      setLeagueName('');
      setGame('');
      setGameType('');
      setTournamentType('');
      setMaxParticipants('');
      setPointsPerWin('3');
      setPointsPerDraw('1');
      setPointsPerLoss('0');
      setLeagueImageBase64(null);

      // navigate to new league detail
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
  const screenWidth = Dimensions.get('window').width;
  const gridPadding = 20;
  const gridGap = 12;
  const myLeaguesCardWidth = (screenWidth - gridPadding * 2 - gridGap) / 2;

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
            Choose your tournament format and customise the settings.
          </Text>

          <WalkthroughCarousel
            slides={[
              { id: '1', icon: '📋', title: 'Name your league', description: 'Give it a clear name so friends can find it.' },
              { id: '2', icon: '🏆', title: 'Pick a format', description: 'League, knockout bracket, or round robin.' },
              { id: '3', icon: '⚙️', title: 'Set options', description: 'Max players, points per win/draw/loss (for leagues).' },
              { id: '4', icon: '👥', title: 'Invite after', description: 'From the league page, invite members and start.' },
            ]}
          />

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
              <WalkthroughCarousel
                slides={[
                  { id: 'league', icon: '🏆', title: 'League', description: 'Points-based. Everyone plays everyone, points determine standings.' },
                  { id: 'knockout', icon: '🥊', title: 'Knockout', description: 'Single elimination bracket. Lose once and you\'re out.' },
                  { id: 'round_robin', icon: '🔄', title: 'Round Robin', description: 'Everyone plays everyone once. Points-based, no elimination.' },
                ]}
                selectedId={tournamentType || null}
                onSelect={(id) => setTournamentType(prev => (prev === id ? '' : id) as 'league' | 'knockout' | 'round_robin' | '')}
              />
            </RNView>

            {/* Game Type Selection */}
            <RNView>
              <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 10, color: textColor, letterSpacing: 0.2 }}>
                Game type (optional)
              </Text>
              <WalkthroughCarousel
                slides={[
                  { id: '', title: 'None', description: 'No specific game type' },
                  ...getAvailableGameTypes().map((g) => ({
                    id: g.id,
                    title: g.name,
                    description: g.description,
                  })),
                ]}
                selectedId={gameType || ''}
                onSelect={(id) => setGameType(id as GameType | '')}
              />
              {gameType ? (
                <Text style={{ fontSize: 12, marginTop: 10, color: t.colors.mutedText, fontWeight: '600' }}>
                  {getAvailableGameTypes().find(g => g.id === gameType)?.description}
                </Text>
              ) : null}
            </RNView>

            {/* League cover image (optional) */}
            <RNView>
              <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 10, color: textColor, letterSpacing: 0.2 }}>
                League image (optional)
              </Text>
              <TouchableOpacity
                  onPress={async () => {
                  try {
                    const ImagePicker = await import('expo-image-picker');
                    if (typeof ImagePicker.requestMediaLibraryPermissionsAsync !== 'function') {
                      Alert.alert('Not available', 'Image picker needs a dev build. Skip or add an image from the league page after creating.');
                      return;
                    }
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert('Permission needed', 'Allow access to photos to add a league image.');
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'],
                      allowsEditing: true,
                      aspect: [16, 9],
                      quality: 0.8,
                      base64: true,
                    });
                    if (!result.canceled && result.assets[0]?.base64) {
                      setLeagueImageBase64(result.assets[0].base64);
                    }
                  } catch (err: any) {
                    if (String(err?.message || '').includes('native module') || String(err?.message || '').includes('ExponentImagePicker')) {
                      Alert.alert('Not available', 'Image picker works on device. Skip or add an image from the league page after creating.');
                    } else {
                      Alert.alert('Error', err?.message ?? 'Could not open photos.');
                    }
                  }
                }}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: borderColor,
                  backgroundColor: cardBg,
                  alignItems: 'center',
                }}
              >
                {leagueImageBase64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${leagueImageBase64}` }} style={{ width: '100%', height: 120, borderRadius: 8 }} resizeMode="cover" />
                ) : null}
                <Text style={{ marginTop: leagueImageBase64 ? 8 : 0, color: t.colors.mutedText, fontWeight: '700', fontSize: 14 }}>
                  {leagueImageBase64 ? 'Change image' : 'Add cover image'}
                </Text>
              </TouchableOpacity>
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
          <ActivityIndicator size="large" color={tint} style={{ marginTop: 20 }} />
        ) : myLeagues.length === 0 ? (
          <Text style={styles.emptyText}>You haven't joined any leagues yet.</Text>
        ) : (
          <RNView style={styles.leagueGrid}>
            {myLeagues.map((item) => {
              const progress = leagueProgress[item.id];
              const hasTournament = item.tournamentFormat && item.tournamentFormat !== 'normal_league';
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  style={[styles.leagueCard, { width: myLeaguesCardWidth }]}
                  onPress={() => router.push({ pathname: '/league/[leagueId]', params: { leagueId: item.id } })}
                >
                  <View
                    style={{
                      backgroundColor: cardBg,
                      borderWidth: 2,
                      borderColor: progress && progress.position === 1 ? tint : borderColor,
                      borderRadius: 14,
                      overflow: 'hidden',
                      shadowColor: progress && progress.position === 1 ? tint : '#000000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: progress && progress.position === 1 ? 0.3 : 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <RNView style={{ width: myLeaguesCardWidth - 4, height: myLeaguesCardWidth * 0.85, backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#E8E8E8' }}>
                      {item.logoUrl ? (
                        <Image source={{ uri: item.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 32, opacity: 0.4 }}>🏆</Text>
                        </RNView>
                      )}
                    </RNView>
                    <RNView style={{ padding: 10 }}>
                      <Text style={[styles.leagueName, { fontWeight: '800', fontSize: 14 }]} numberOfLines={2}>{item.name}</Text>
                      {hasTournament && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push({ pathname: '/league/[leagueId]/bracket', params: { leagueId: item.id } });
                          }}
                          style={{ marginTop: 6 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: tint }}>View Bracket</Text>
                        </TouchableOpacity>
                      )}
                    </RNView>
                  </View>
                </TouchableOpacity>
              );
            })}
          </RNView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 
