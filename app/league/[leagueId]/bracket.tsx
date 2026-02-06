// I display the tournament bracket and standings; I support score entry and admin verification. Bracket styling ref: https://chatgpt.com/share/691dab97-d050-8007-9ba3-69de17a2cc4c
// Ref: Date toLocaleDateString - https://www.w3schools.com/jsref/jsref_tolocaledatestring.asp
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, RefreshControl, ScrollView, TextInput, TouchableOpacity, View as RNView } from 'react-native';
import { Text, View } from '../../../components/Themed';
import Logo from '../../../components/Logo';
import { useColorScheme } from '../../../components/useColorScheme';
import Colors from '../../../constants/Colors';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../../FirebaseConfig';
import { getTournamentBracket, getTournamentStandings, Match, autoGenerateBracketIfNeeded, updateMatchScore, verifyMatchScore } from '../../../components/lib/tournaments';
import { getGameConfig, GameType } from '../../../components/lib/gameTypes';

type LeagueDoc = {
  name: string;
  game?: string | null;
  gameType?: GameType | null;
  ownerId: string;
  admins?: string[];
  numberOfRounds?: number | null;
  tournamentFormat?: 'normal_league' | 'single_elimination' | 'double_elimination' | 'round_robin' | null;
};

export default function TournamentBracketScreen() {
  const params = useLocalSearchParams();
  const leagueId =
    (Array.isArray(params.leagueId) ? params.leagueId[0] : (params.leagueId as string | undefined)) ??
    (Array.isArray((params as any).leagueID) ? (params as any).leagueID[0] : ((params as any).leagueID as string | undefined));

  const router = useRouter();
  // I get theme colours for light and dark mode
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
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [player1Score, setPlayer1Score] = useState('');
  const [player2Score, setPlayer2Score] = useState('');
  const [player1Scores, setPlayer1Scores] = useState<Record<string, string>>({});
  const [player2Scores, setPlayer2Scores] = useState<Record<string, string>>({});
  const [savingScore, setSavingScore] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const uid = auth.currentUser?.uid ?? null;

  // calculate the user's position in the standings
  const userPosition = useMemo(() => {
    if (!uid || standings.length === 0) return null;
    const index = standings.findIndex(s => s.userId === uid);
    return index >= 0 ? index + 1 : null;
  }, [uid, standings]);

  // get the user's statistics from the standings
  const userStats = useMemo(() => {
    if (!uid || standings.length === 0) return null;
    return standings.find(s => s.userId === uid) || null;
  }, [uid, standings]);

  // filter matches to show only the current user's matches
  const userMatches = useMemo(() => {
    if (!uid || !bracket) return [];
    return bracket.matches.filter(
      m => m.player1Id === uid || m.player2Id === uid
    );
  }, [uid, bracket]);

  // load league data and check if the user has admin permissions
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
      const leagueData = snap.data() as LeagueDoc;
      setLeague(leagueData);
      
      // check if the user is an owner, league admin, or system admin
      if (uid) {
        const isOwner = leagueData.ownerId === uid;
        const isLeagueAdmin = Array.isArray((leagueData as any).admins) && (leagueData as any).admins.includes(uid);
        
        // I check if the user is a system admin
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : null;
        const isSystemAdmin = userData?.role === 'admin';
        
        setIsAdmin(isOwner || isLeagueAdmin || isSystemAdmin);
      }
    } catch (e) {
    }
  }, [leagueId, router, uid]);

  // load all active members and create a map for quick name lookups
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
    }
  }, [leagueId]);

  // I load the bracket and standings, auto-generating brackets if needs be
  const loadBracket = useCallback(async () => {
    if (!leagueId) { setLoading(false); setRefreshing(false); return; }
    try {
      setLoading(true);
      
      // I auto-generate brackets if needed before loading to ensure the bracket tab is always useful
      await autoGenerateBracketIfNeeded(leagueId);
      
      const [bracketData, standingsData] = await Promise.all([
        getTournamentBracket(leagueId),
        getTournamentStandings(leagueId),
      ]);
      setBracket(bracketData);
      setStandings(standingsData);
      await loadMembers();
    } catch (e) {
      Alert.alert('Error', 'Failed to load tournament bracket.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId, loadMembers]);

  useEffect(() => {
    loadLeague();
  }, [leagueId]);

  useEffect(() => {
    loadBracket();
  }, [leagueId]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadLeague(), loadBracket()]).finally(() => setRefreshing(false));
  };

  // Handle opening score entry 
  const openScoreModal = (match: Match) => {
    setSelectedMatch(match);
    
    // determing if we should use game-specific scoring based on league gameType
    const gameConfig = league ? getGameConfig(league.gameType) : null;
    const shouldUseGameSpecific = gameConfig && gameConfig.id !== 'GENERIC';
    
    // I load existing scores (legacy or game-specific)
    if (shouldUseGameSpecific && match.result?.player1Scores && match.result?.player2Scores) {
      // Game-specific scores exist - load them
      const p1Scores: Record<string, string> = {};
      const p2Scores: Record<string, string> = {};
      
      // populating all fields from the game config, using existing values or empty strings
      gameConfig.scoringFields.forEach(field => {
        p1Scores[field.id] = match.result?.player1Scores?.[field.id]?.toString() || '';
        p2Scores[field.id] = match.result?.player2Scores?.[field.id]?.toString() || '';
      });
      
      setPlayer1Scores(p1Scores);
      setPlayer2Scores(p2Scores);
      setPlayer1Score('');
      setPlayer2Score('');
    } else if (shouldUseGameSpecific && gameConfig) {
      // Game-specific mode but no scores yet - initialise empty fields
      const p1Scores: Record<string, string> = {};
      const p2Scores: Record<string, string> = {};
      
      gameConfig.scoringFields.forEach(field => {
        p1Scores[field.id] = '';
        p2Scores[field.id] = '';
      });
      
      setPlayer1Scores(p1Scores);
      setPlayer2Scores(p2Scores);
      setPlayer1Score('');
      setPlayer2Score('');
    } else {
      // Legacy numeric scores
      setPlayer1Score(match.result?.player1Score?.toString() || '');
      setPlayer2Score(match.result?.player2Score?.toString() || '');
      setPlayer1Scores({});
      setPlayer2Scores({});
    }
    setScoreModalVisible(true);
  };

  // Handle saving match score
  const handleSaveScore = async () => {
    if (!selectedMatch || !league) return;
    
    const gameConfig = getGameConfig(league.gameType);
    // I determine if game-specific based on league gameType, not just wetherr scores exist
    const isGameSpecific = gameConfig.id !== 'GENERIC';
    
    if (isGameSpecific) {
      // Validate game-specific scores
      const p1Scores: Record<string, any> = {};
      const p2Scores: Record<string, any> = {};
      
      for (const field of gameConfig.scoringFields) {
        const p1Value = player1Scores[field.id]?.trim() || '';
        const p2Value = player2Scores[field.id]?.trim() || '';
        
        if (field.required && (!p1Value || !p2Value)) {
          Alert.alert('Invalid Scores', `Please enter ${field.label} for both players.`);
          return;
        }
        
        // Process player 1 score - only include if it has a value
        if (p1Value) {
          if (field.type === 'number') {
            const num = parseFloat(p1Value);
            if (isNaN(num) || num < 0) {
              Alert.alert('Invalid Scores', `${field.label} must be a non-negative number.`);
              return;
            }
            p1Scores[field.id] = num;
          } else {
            p1Scores[field.id] = p1Value;
          }
        }
        // I don't include optional fields if they're empty 
        
        // Process player 2 score - only include if it has a value
        if (p2Value) {
          if (field.type === 'number') {
            const num = parseFloat(p2Value);
            if (isNaN(num) || num < 0) {
              Alert.alert('Invalid Scores', `${field.label} must be a non-negative number.`);
              return;
            }
            p2Scores[field.id] = num;
          } else {
            p2Scores[field.id] = p2Value;
          }
        }
        // I don't include optional fields if they're empty 
      }
      
      try {
        setSavingScore(true);
        await updateMatchScore(selectedMatch.id, p1Scores, p2Scores, league.gameType || undefined);
        Alert.alert('Success', 'Match score submitted. Waiting for admin verification.');
        setScoreModalVisible(false);
        await loadBracket(); // Reload bracket to show updated scores
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to submit match score.');
      } finally {
        setSavingScore(false);
      }
    } else {
      // old numeric scores
      const p1Score = parseInt(player1Score, 10);
      const p2Score = parseInt(player2Score, 10);
      
      if (isNaN(p1Score) || isNaN(p2Score) || p1Score < 0 || p2Score < 0) {
        Alert.alert('Invalid Scores', 'Please enter valid non-negative numbers for both scores.');
        return;
      }
      
      try {
        setSavingScore(true);
        await updateMatchScore(selectedMatch.id, p1Score, p2Score);
        Alert.alert('Success', 'Match score submitted. Waiting for admin verification.');
        setScoreModalVisible(false);
        await loadBracket(); // Reload bracket to show updated scores
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to submit match score.');
      } finally {
        setSavingScore(false);
      }
    }
  };

  // Handle verifying match score (admin only)
  const handleVerifyScore = async (matchId: string) => {
    try {
      await verifyMatchScore(matchId);
      Alert.alert('Success', 'Match score verified successfully.');
      await loadBracket(); // Reload bracket to show verified scores
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify match score.');
    }
  };

  // I get a player's display name or fall back to a shortened user ID
  const getPlayerName = (userId: string | null | undefined): string => {
    if (!userId) return 'TBD';
    const member = memberMap[userId];
    return member?.displayName || userId.substring(0, 8) + '...';
  };

  // I format match scores for display, showing game-specific scores when available
  const formatMatchScore = (match: Match, player: 'player1' | 'player2'): string | null => {
    if (!match.result) return null;
    
    // Check for game-specific scores
    if (player === 'player1' && match.result.player1Scores && league) {
      const gameConfig = getGameConfig(league.gameType);
      const primaryField = gameConfig.scoringFields.find(f => f.required) || gameConfig.scoringFields[0];
      if (primaryField && match.result.player1Scores[primaryField.id] !== undefined) {
        return String(match.result.player1Scores[primaryField.id]);
      }
    }
    if (player === 'player2' && match.result.player2Scores && league) {
      const gameConfig = getGameConfig(league.gameType);
      const primaryField = gameConfig.scoringFields.find(f => f.required) || gameConfig.scoringFields[0];
      if (primaryField && match.result.player2Scores[primaryField.id] !== undefined) {
        return String(match.result.player2Scores[primaryField.id]);
      }
    }
    
    // Fall back to legacy numeric scores
    if (player === 'player1' && match.result.player1Score !== undefined) {
      return String(match.result.player1Score);
    }
    if (player === 'player2' && match.result.player2Score !== undefined) {
      return String(match.result.player2Score);
    }
    
    return null;
  };

  // I check if this is a bracket-style tournament
  const isBracketTournament = useMemo(() => {
    return league?.tournamentFormat === 'single_elimination' || league?.tournamentFormat === 'double_elimination';
  }, [league?.tournamentFormat]);

  // Organise matches by round for bracket display
  const matchesByRound = useMemo(() => {
    if (!bracket || !isBracketTournament) return {};
    const rounds: Record<number, Match[]> = {};
    bracket.matches.forEach(match => {
      if (!rounds[match.round]) {
        rounds[match.round] = [];
      }
      rounds[match.round].push(match);
    });
    // Sort matches within each round by match number
    Object.keys(rounds).forEach(round => {
      rounds[parseInt(round)].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
    });
    return rounds;
  }, [bracket, isBracketTournament]);

  // I render the bracket tree visualisation with connecting lines between rounds
  const renderBracketTree = () => {
    if (!bracket || !isBracketTournament || Object.keys(matchesByRound).length === 0) {
      return (
        <RNView style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ opacity: 0.7, fontSize: 16 }}>No bracket matches available yet.</Text>
        </RNView>
      );
    }

    const rounds = Object.keys(matchesByRound).map(r => parseInt(r)).sort((a, b) => a - b);
    const maxRound = Math.max(...rounds);
    const screenWidth = Dimensions.get('window').width;
    const bracketPadding = 16;
    const columnSpacing = 30;
    const matchWidth = 140;
    const matchHeight = 70;
    const verticalSpacing = 16;

    // Calculate total width needed
    const totalWidth = (matchWidth + columnSpacing) * rounds.length + bracketPadding * 2;

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={true} 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 20 }}
      >
        <RNView style={{ flexDirection: 'row', paddingHorizontal: bracketPadding, minWidth: Math.max(totalWidth, screenWidth) }}>
          {rounds.map((round, roundIndex) => {
            const matches = matchesByRound[round];
            const isFinalRound = round === maxRound;
            
            return (
              <RNView
                key={round}
                style={{
                  width: matchWidth,
                  marginRight: roundIndex < rounds.length - 1 ? columnSpacing : 0,
                  position: 'relative',
                }}
              >
                {/* Round Label */}
                <RNView style={{ marginBottom: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: isFinalRound ? tint : textColor }}>
                    {isFinalRound ? '👑 Final' : `Round ${String(round)}`}
                  </Text>
                </RNView>

                {/* Matches in this round */}
                <RNView style={{ gap: verticalSpacing }}>
                  {matches.map((match, matchIndex) => {
                    const isUserMatch = uid && (match.player1Id === uid || match.player2Id === uid);
                    const isCompleted = match.status === 'completed';
                    const isVerified = match.result?.verified === true;
                    const isUnverified = isCompleted && !isVerified;
                    const winnerId = isVerified ? match.result?.winnerId : null;
                    const player1Name = getPlayerName(match.player1Id);
                    const player2Name = match.player2Id ? getPlayerName(match.player2Id) : 'TBD';
                    const isUserInMatch = uid && (match.player1Id === uid || match.player2Id === uid);

                    return (
                      <RNView key={match.id} style={{ position: 'relative' }}>
                        {/* Match Box */}
                        <View
                          style={{
                            borderWidth: 2,
                            borderColor: isUserMatch ? tint : (isCompleted && isVerified && winnerId ? tint : borderColor),
                            backgroundColor: isUserMatch 
                              ? (colorScheme === 'dark' ? 'rgba(220,20,60,0.15)' : 'rgba(220,20,60,0.08)')
                              : cardBg,
                            borderRadius: 8,
                            padding: 8,
                            minHeight: matchHeight,
                            shadowColor: isUserMatch ? tint : '#000000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isUserMatch ? 0.3 : 0.1,
                            shadowRadius: 4,
                            elevation: isUserMatch ? 5 : 2,
                          }}
                        >
                          {/* Player 1 */}
                          <RNView style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: 4,
                            paddingVertical: 4,
                            paddingHorizontal: 6,
                            backgroundColor: (isVerified && winnerId === match.player1Id) ? (colorScheme === 'dark' ? 'rgba(220,20,60,0.2)' : 'rgba(220,20,60,0.1)') : 'transparent',
                            borderRadius: 4,
                          }}>
                            <Text 
                              numberOfLines={1}
                              style={{ 
                                fontSize: 11,
                                fontWeight: (isVerified && winnerId === match.player1Id) ? '800' : (match.player1Id === uid ? '700' : '500'),
                                color: match.player1Id === uid ? tint : ((isVerified && winnerId === match.player1Id) ? tint : textColor),
                                flex: 1,
                              }}
                            >
                              {player1Name}
                            </Text>
                            {isCompleted && formatMatchScore(match, 'player1') && (
                              <Text style={{ fontSize: 10, fontWeight: '700', color: textColor, marginLeft: 4 }}>
                                {formatMatchScore(match, 'player1')}
                              </Text>
                            )}
                          </RNView>

                          {/* Divider */}
                          <RNView style={{ 
                            height: 1, 
                            backgroundColor: borderColor, 
                            marginVertical: 4,
                            opacity: 0.3,
                          }} />

                          {/* Player 2 */}
                          <RNView style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            paddingVertical: 4,
                            paddingHorizontal: 6,
                            backgroundColor: (isVerified && winnerId === match.player2Id) ? (colorScheme === 'dark' ? 'rgba(220,20,60,0.2)' : 'rgba(220,20,60,0.1)') : 'transparent',
                            borderRadius: 4,
                          }}>
                            <Text 
                              numberOfLines={1}
                              style={{ 
                                fontSize: 11,
                                fontWeight: (isVerified && winnerId === match.player2Id) ? '800' : (match.player2Id === uid ? '700' : '500'),
                                color: match.player2Id === uid ? tint : ((isVerified && winnerId === match.player2Id) ? tint : textColor),
                                flex: 1,
                              }}
                            >
                              {player2Name}
                            </Text>
                            {isCompleted && formatMatchScore(match, 'player2') && (
                              <Text style={{ fontSize: 10, fontWeight: '700', color: textColor, marginLeft: 4 }}>
                                {formatMatchScore(match, 'player2')}
                              </Text>
                            )}
                          </RNView>

                          {/* Status indicator */}
                          {isUserMatch && (
                            <RNView style={{ 
                              position: 'absolute', 
                              top: -6, 
                              right: -6, 
                              backgroundColor: tint, 
                              borderRadius: 10, 
                              width: 20, 
                              height: 20, 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              borderWidth: 2,
                              borderColor: '#000000',
                            }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>★</Text>
                            </RNView>
                          )}
                          {/* Crown icon for final round winner (only if verified) */}
                          {isFinalRound && isCompleted && isVerified && winnerId && (
                            <RNView style={{ 
                              position: 'absolute', 
                              top: -8, 
                              left: -8, 
                              backgroundColor: tint, 
                              borderRadius: 12, 
                              width: 24, 
                              height: 24, 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              borderWidth: 2,
                              borderColor: '#000000',
                            }}>
                              <Text style={{ fontSize: 12 }}>👑</Text>
                            </RNView>
                          )}
                          
                          {/* Score Entry Button - All users can submit scores for their matches */}
                          {(isUserInMatch || isAdmin) && (
                            <TouchableOpacity
                              onPress={() => openScoreModal(match)}
                              style={{
                                marginTop: 6,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                borderRadius: 6,
                                backgroundColor: tint,
                                borderWidth: 1,
                                borderColor: '#000000',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 10 }}>
                                {isCompleted ? 'Edit Score' : 'Enter Score'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          
                          {/* Verify Button for Admins - Only show if score is unverified */}
                          {isAdmin && isUnverified && (
                            <TouchableOpacity
                              onPress={() => handleVerifyScore(match.id)}
                              style={{
                                marginTop: 6,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                borderRadius: 6,
                                backgroundColor: '#28A745',
                                borderWidth: 1,
                                borderColor: '#000000',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 10 }}>
                                Verify Score
                              </Text>
                            </TouchableOpacity>
                          )}
                          
                          {/* Verification Status Indicator */}
                          {isCompleted && (
                            <Text style={{ 
                              fontSize: 9, 
                              marginTop: 4,
                              color: isVerified ? '#28A745' : '#FFC107',
                              fontWeight: '600'
                            }}>
                              {isVerified ? '✓ Verified' : '⏳ Pending Verification'}
                            </Text>
                          )}
                        </View>

                        {/* Connecting lines to next round (if not final round) */}
                        {!isFinalRound && (
                          <>
                            {/* Horizontal line to next round */}
                            <RNView
                              style={{
                                position: 'absolute',
                                right: -columnSpacing,
                                top: matchHeight / 2 - 1,
                                width: columnSpacing,
                                height: 2,
                                backgroundColor: borderColor,
                                opacity: 0.6,
                                zIndex: 0,
                              }}
                            />
                            {/* Vertical line connecting pairs of matches */}
                            {matchIndex % 2 === 0 && matches.length > matchIndex + 1 && (
                              <>
                                {/* Top vertical line from this match */}
                                <RNView
                                  style={{
                                    position: 'absolute',
                                    right: -columnSpacing,
                                    top: matchHeight / 2,
                                    width: 2,
                                    height: (matchHeight + verticalSpacing) / 2,
                                    backgroundColor: borderColor,
                                    opacity: 0.6,
                                    zIndex: 0,
                                  }}
                                />
                                {/* Bottom vertical line to next match */}
                                <RNView
                                  style={{
                                    position: 'absolute',
                                    right: -columnSpacing,
                                    bottom: -(matchHeight + verticalSpacing) / 2,
                                    width: 2,
                                    height: (matchHeight + verticalSpacing) / 2,
                                    backgroundColor: borderColor,
                                    opacity: 0.6,
                                    zIndex: 0,
                                  }}
                                />
                              </>
                            )}
                            {/* For odd-numbered matches or last match in round, extend line down */}
                            {matchIndex % 2 === 1 && (
                              <RNView
                                style={{
                                  position: 'absolute',
                                  right: -columnSpacing,
                                  top: matchHeight / 2,
                                  width: 2,
                                  height: (matchHeight + verticalSpacing) / 2,
                                  backgroundColor: borderColor,
                                  opacity: 0.6,
                                  zIndex: 0,
                                }}
                              />
                            )}
                          </>
                        )}
                      </RNView>
                    );
                  })}
                </RNView>
              </RNView>
            );
          })}
        </RNView>
      </ScrollView>
    );
  };

  // I render a single match in list view with score entry and verification options
  const renderMatch = (match: Match) => {
    const isCompleted = match.status === 'completed';
    const isVerified = match.result?.verified === true;
    const isUnverified = isCompleted && !isVerified;
    const hasResult = match.result && match.result.winnerId && isVerified;
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
            Round {String(match.round)} • Match {String(match.matchNumber)}
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
              fontWeight: (hasResult && isVerified && match.result?.winnerId === match.player1Id) ? '800' : (match.player1Id === uid ? '700' : '400'),
              fontSize: 16,
              color: match.player1Id === uid ? tint : textColor,
            }}>
              {player1Name}
            </Text>
            {isCompleted && formatMatchScore(match, 'player1') && (
              <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 4, fontWeight: '600' }}>
                Score: {formatMatchScore(match, 'player1')}
              </Text>
            )}
          </RNView>
          <Text style={{ marginHorizontal: 12, opacity: 0.5, fontSize: 16, fontWeight: '600' }}>vs</Text>
          <RNView style={{ flex: 1, alignItems: 'flex-end' }}>
            {player2Name ? (
              <>
                <Text style={{ 
                  fontWeight: (hasResult && isVerified && match.result?.winnerId === match.player2Id) ? '800' : (match.player2Id === uid ? '700' : '400'),
                  fontSize: 16,
                  color: match.player2Id === uid ? tint : textColor,
                }}>
                  {player2Name}
                </Text>
                {isCompleted && formatMatchScore(match, 'player2') && (
                  <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 4, fontWeight: '600' }}>
                    Score: {formatMatchScore(match, 'player2')}
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
          {hasResult && isVerified && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: tint }}>
              Winner: {getPlayerName(match.result?.winnerId)}
            </Text>
          )}
        </RNView>
        {/* Score Entry Button - All users can submit scores for their matches */}
        {(isUserMatch || isAdmin) && (
          <TouchableOpacity
            onPress={() => openScoreModal(match)}
            style={{
              marginTop: 12,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: tint,
              borderWidth: 2,
              borderColor: '#000000',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
              {isCompleted ? 'Edit Score' : 'Enter Score'}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Verify Button for Admins - Only show if score is unverified */}
        {isAdmin && isUnverified && (
          <TouchableOpacity
            onPress={() => handleVerifyScore(match.id)}
            style={{
              marginTop: 8,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: '#28A745',
              borderWidth: 2,
              borderColor: '#000000',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
              Verify Score
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Verification Status Indicator */}
        {isCompleted && (
          <Text style={{ 
            fontSize: 12, 
            marginTop: 8,
            color: isVerified ? '#28A745' : '#FFC107',
            fontWeight: '700'
          }}>
            {isVerified ? '✓ Verified' : '⏳ Pending Verification'}
          </Text>
        )}
      </View>
    );
  };

  // I render the leaderboard standings with player positions and statistics
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
                #{String(index + 1)}
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
                  {String(player.wins)}W - {String(player.losses)}L
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
          headerBackVisible: true,
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <RNView style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: borderColor, marginHorizontal: 20, marginBottom: 20 }}>
          <Logo size="small" showTagline={false} />
        </RNView>
        
        {/* Game Type Badge */}
        {league && league.gameType && (
          <RNView style={{ 
            marginHorizontal: 16, 
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: tint,
            backgroundColor: colorScheme === 'dark' ? 'rgba(220,20,60,0.15)' : 'rgba(220,20,60,0.08)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: tint,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <RNView style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: textColor, opacity: 0.7, marginBottom: 4 }}>
                GAME TYPE
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: tint, letterSpacing: 0.5 }}>
                {getGameConfig(league.gameType).name}
              </Text>
              <Text style={{ fontSize: 12, opacity: 0.6, marginTop: 4, color: textColor }}>
                {getGameConfig(league.gameType).description}
              </Text>
            </RNView>
            {league.game && (
              <RNView style={{ 
                paddingHorizontal: 12, 
                paddingVertical: 6, 
                borderRadius: 8, 
                backgroundColor: tint,
                borderWidth: 2,
                borderColor: '#000000',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                  {league.game}
                </Text>
              </RNView>
            )}
          </RNView>
        )}
        
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
                Position: <Text style={{ color: tint, fontSize: 20 }}>#{String(userPosition)}</Text>
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>
                {String(userStats.wins)}W - {String(userStats.losses)}L
              </Text>
            </RNView>
            {userStats.winRate > 0 && (
              <Text style={{ fontSize: 14, opacity: 0.7, fontWeight: '600' }}>
                Win Rate: {userStats.winRate.toFixed(1)}%
              </Text>
            )}
            {userMatches.length > 0 && (
              <Text style={{ fontSize: 14, opacity: 0.7, marginTop: 8, fontWeight: '600' }}>
                Your Matches: {String(userMatches.filter(m => m.status === 'pending').length)} upcoming, {String(userMatches.filter(m => m.status === 'completed').length)} completed
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
                    // Filter to show only user matches - I'll implement this with state
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
                    My Matches ({String(userMatches.length)})
                  </Text>
                </TouchableOpacity>
              )}
            </RNView>
            {loading ? (
              <RNView style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={tint} />
              </RNView>
            ) : bracket && bracket.matches.length > 0 ? (
              <RNView style={{ flex: 1, minHeight: 400 }}>
                {isBracketTournament ? (
                  // Show bracket tree for bracket tournaments
                  renderBracketTree()
                ) : (
                  // Show list view for other tournament types
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
                )}
              </RNView>
            ) : (
              <RNView style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ opacity: 0.7, fontSize: 16 }}>No matches scheduled yet.</Text>
              </RNView>
            )}
          </>
        )}
      </ScrollView>

      {/* Score Entry Modal */}
      <Modal
        visible={scoreModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setScoreModalVisible(false)}
      >
        <RNView style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: borderColor,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
          }}>
            <Text style={{
              fontSize: 24,
              fontWeight: '800',
              marginBottom: 8,
              color: textColor,
            }}>
              Enter Match Score
            </Text>
            {selectedMatch && league && (
              <>
                <Text style={{
                  fontSize: 14,
                  opacity: 0.7,
                  marginBottom: 8,
                  color: textColor,
                }}>
                  Round {selectedMatch.round} • Match {selectedMatch.matchNumber}
                </Text>
                
                {/* Game Type Indicator in Modal */}
                {league.gameType && (
                  <RNView style={{
                    marginBottom: 16,
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: tint,
                    backgroundColor: colorScheme === 'dark' ? 'rgba(220,20,60,0.1)' : 'rgba(220,20,60,0.05)',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: textColor, opacity: 0.7, marginBottom: 4 }}>
                      SCORING SYSTEM
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: tint }}>
                      {getGameConfig(league.gameType).name}
                    </Text>
                  </RNView>
                )}
                
                {(() => {
                  const gameConfig = getGameConfig(league.gameType);
                  const isGameSpecific = gameConfig.id !== 'GENERIC';
                  
                  if (isGameSpecific) {
                    // Render game-specific scoring fields
                    return (
                      <>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '800',
                          marginBottom: 16,
                          color: textColor,
                        }}>
                          {getPlayerName(selectedMatch.player1Id)}
                        </Text>
                        {gameConfig.scoringFields.map((field) => (
                          <RNView key={`p1_${field.id}`} style={{ marginBottom: 12 }}>
                            <RNView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: textColor,
                              }}>
                                {field.label}
                              </Text>
                              {field.required ? (
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC143C', marginLeft: 4 }}>*</Text>
                              ) : (
                                <Text style={{ fontSize: 12, fontWeight: '600', color: textColor, opacity: 0.6, marginLeft: 6 }}>
                                  (Optional)
                                </Text>
                              )}
                            </RNView>
                            <TextInput
                              style={{
                                borderWidth: 2,
                                borderColor: field.required && !player1Scores[field.id] ? '#FFC107' : borderColor,
                                backgroundColor: cardBg,
                                borderRadius: 10,
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                fontSize: 16,
                                fontWeight: '500',
                                color: textColor,
                              }}
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                              value={player1Scores[field.id] || ''}
                              onChangeText={(text) => {
                                setPlayer1Scores(prev => ({ ...prev, [field.id]: text }));
                              }}
                              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                              placeholderTextColor="#999999"
                            />
                          </RNView>
                        ))}
                        
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '800',
                          marginTop: 16,
                          marginBottom: 16,
                          color: textColor,
                        }}>
                          {getPlayerName(selectedMatch.player2Id)}
                        </Text>
                        {gameConfig.scoringFields.map((field) => (
                          <RNView key={`p2_${field.id}`} style={{ marginBottom: 12 }}>
                            <RNView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: textColor,
                              }}>
                                {field.label}
                              </Text>
                              {field.required ? (
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC143C', marginLeft: 4 }}>*</Text>
                              ) : (
                                <Text style={{ fontSize: 12, fontWeight: '600', color: textColor, opacity: 0.6, marginLeft: 6 }}>
                                  (Optional)
                                </Text>
                              )}
                            </RNView>
                            <TextInput
                              style={{
                                borderWidth: 2,
                                borderColor: field.required && !player2Scores[field.id] ? '#FFC107' : borderColor,
                                backgroundColor: cardBg,
                                borderRadius: 10,
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                fontSize: 16,
                                fontWeight: '500',
                                color: textColor,
                              }}
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                              value={player2Scores[field.id] || ''}
                              onChangeText={(text) => {
                                setPlayer2Scores(prev => ({ ...prev, [field.id]: text }));
                              }}
                              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                              placeholderTextColor="#999999"
                            />
                          </RNView>
                        ))}
                      </>
                    );
                  } else {
                    // Render legacy numeric score inputs
                    return (
                      <>
                        <RNView style={{ marginBottom: 16 }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            marginBottom: 8,
                            color: textColor,
                          }}>
                            {getPlayerName(selectedMatch.player1Id)}
                          </Text>
                          <TextInput
                            style={{
                              borderWidth: 2,
                              borderColor: borderColor,
                              backgroundColor: cardBg,
                              borderRadius: 10,
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              fontSize: 18,
                              fontWeight: '600',
                              color: textColor,
                            }}
                            placeholder="0"
                            value={player1Score}
                            onChangeText={setPlayer1Score}
                            keyboardType="numeric"
                            placeholderTextColor="#999999"
                          />
                        </RNView>

                        <RNView style={{ marginBottom: 24 }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            marginBottom: 8,
                            color: textColor,
                          }}>
                            {getPlayerName(selectedMatch.player2Id)}
                          </Text>
                          <TextInput
                            style={{
                              borderWidth: 2,
                              borderColor: borderColor,
                              backgroundColor: cardBg,
                              borderRadius: 10,
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              fontSize: 18,
                              fontWeight: '600',
                              color: textColor,
                            }}
                            placeholder="0"
                            value={player2Score}
                            onChangeText={setPlayer2Score}
                            keyboardType="numeric"
                            placeholderTextColor="#999999"
                          />
                        </RNView>
                      </>
                    );
                  }
                })()}

                <RNView style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setScoreModalVisible(false)}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: borderColor,
                      backgroundColor: cardBg,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      color: textColor,
                      fontWeight: '700',
                      fontSize: 16,
                    }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveScore}
                    disabled={savingScore}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 10,
                      backgroundColor: tint,
                      borderWidth: 2,
                      borderColor: '#000000',
                      alignItems: 'center',
                      opacity: savingScore ? 0.7 : 1,
                    }}
                  >
                    {savingScore ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={{
                        color: '#FFFFFF',
                        fontWeight: '700',
                        fontSize: 16,
                      }}>
                        Save Score
                      </Text>
                    )}
                  </TouchableOpacity>
                </RNView>
              </>
            )}
          </View>
        </RNView>
      </Modal>
    </>
  );
}


