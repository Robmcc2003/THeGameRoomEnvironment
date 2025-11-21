import { auth, db } from '../../FirebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

export type TournamentStatus = 'pending' | 'active' | 'completed';
export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export type MatchResult = {
  player1Score?: number;
  player2Score?: number;
  winnerId?: string;
};

export type Match = {
  id: string;
  leagueId: string;
  round: number;
  matchNumber: number;
  player1Id: string;
  player2Id?: string | null;
  status: MatchStatus;
  result?: MatchResult;
  scheduledAt?: any;
  completedAt?: any;
};

export type TournamentBracket = {
  matches: Match[];
  rounds: number;
  currentRound: number;
};

// Join a tournament/league
export async function joinTournament(leagueId: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);
  
  if (!leagueSnap.exists()) {
    throw new Error('League not found.');
  }

  const leagueData = leagueSnap.data();
  
  // Check if league is full
  if (leagueData.maxParticipants) {
    const membersQuery = query(
      collection(db, 'leagueMembers'),
      where('leagueId', '==', leagueId),
      where('status', '==', 'active')
    );
    const membersSnap = await getDocs(membersQuery);
    
    if (membersSnap.size >= leagueData.maxParticipants) {
      throw new Error('Tournament is full. Maximum participants reached.');
    }
  }

  // Check if the user is already a member
  // I create a unique ID by combining leagueId and userId
  const memberId = `${leagueId}_${current.uid}`;
  const memberRef = doc(db, 'leagueMembers', memberId);
  const memberSnap = await getDoc(memberRef);

  // If they're already a member, don't add them again
  if (memberSnap.exists()) {
    throw new Error('You are already a member of this tournament.');
  }

  // Get the user's profile to include their username/display name
  // This makes it easier to identify them in the tournament
  const userRef = doc(db, 'users', current.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : null;
  // Use displayName if available, otherwise username, otherwise email prefix, otherwise "Player"
  const displayName = userData?.displayName || userData?.username || current.email?.split('@')[0] || 'Player';
  const username = userData?.username || null;

  // Add the user as a member of the league
  // setDoc() creates or overwrites a document
  // Firestore docs: https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document
  await setDoc(memberRef, {
    id: memberId,
    leagueId,
    userId: current.uid,
    role: 'member', // They're a regular member (not admin)
    status: 'active', // They're actively participating
    displayName: displayName, // Their display name for the tournament
    username: username, // Their username
    joinedAt: serverTimestamp(), // When they joined (server timestamp is more accurate)
    addedBy: current.uid, // Who added them (themselves in this case)
  });
}

// Get Tournament Bracket
// This function retrieves all matches for a tournament and organizes them into a bracket.
// It returns the matches sorted by round and match number, plus information about
// how many rounds there are and which round is currently active.
// Reference: https://firebase.google.com/docs/firestore/query-data/get-data#get_multiple_documents_from_a_collection
// @param leagueId - The unique ID of the league/tournament
// @returns Tournament bracket with all matches, or null if no matches exist
export async function getTournamentBracket(leagueId: string): Promise<TournamentBracket | null> {
  // Get all matches for this league
  // I query the tournamentMatches collection for all matches with this leagueId
  const matchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId)
  );
  
  // Execute the query and get all matching documents
  const matchesSnap = await getDocs(matchesQuery);
  // Convert Firestore documents to my Match type
  const matches: Match[] = matchesSnap.docs.map(d => ({
    id: d.id, // Document ID
    ...(d.data() as any), // All other data (round, player1Id, etc.)
  }));

  // If there are no matches, return null
  if (matches.length === 0) {
    return null;
  }

  // Calculate the total number of rounds
  // I find the highest round number among all matches
  const rounds = Math.max(...matches.map(m => m.round || 0), 0);
  
  // Calculate which round is currently active
  // This is the lowest round number that has incomplete matches
  const currentRound = Math.min(
    ...matches
      .filter(m => m.status !== 'completed') // Only look at incomplete matches
      .map(m => m.round || 0), // Get their round numbers
    rounds // Default to total rounds if all are complete
  );

  // Return the bracket with matches sorted by round, then by match number
  return {
    matches: matches.sort((a, b) => {
      // Sort by round first (Round 1, then Round 2, etc.)
      if (a.round !== b.round) return a.round - b.round;
      // Within the same round, sort by match number (Match 1, then Match 2, etc.)
      return (a.matchNumber || 0) - (b.matchNumber || 0);
    }),
    rounds,
    currentRound: currentRound || 1,
  };
}

// Generate Bracket Matches
// This function automatically creates all the matches for a tournament bracket.
// It's used for single-elimination tournaments where players are eliminated after losing.
// How it works:
// 1. Gets all participants
// 2. Randomly shuffles them (for fair seeding)
// 3. Pairs them up for the first round
// 4. Handles "byes" if there's an odd number of players (some players get a free pass)
// 5. Creates placeholder matches for later rounds (these get filled as winners advance)
// Tournament bracket theory: https://en.wikipedia.org/wiki/Single-elimination_tournament
// @param leagueId - The unique ID of the league/tournament
// @throws Error if user not signed in, not owner/admin, wrong tournament format, matches already exist, or not enough participants
export async function generateBracketMatches(leagueId: string): Promise<void> {
  // Get the currently signed-in user
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  // Get the league document
  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);
  
  if (!leagueSnap.exists()) {
    throw new Error('League not found.');
  }

  const leagueData = leagueSnap.data();
  
  // Check if the user is the owner or an admin
  // Only owners/admins can generate matches (to prevent random users from creating fake matches)
  const isOwner = leagueData.ownerId === current.uid;
  const isAdmin = Array.isArray(leagueData.admins) && leagueData.admins.includes(current.uid);
  if (!isOwner && !isAdmin) {
    throw new Error('Only league owners and admins can generate matches.');
  }

  // Check if this is a bracket tournament
  // Match generation only works for single or double elimination tournaments
  const tournamentFormat = leagueData.tournamentFormat;
  if (tournamentFormat !== 'single_elimination' && tournamentFormat !== 'double_elimination') {
    throw new Error('Match generation is only available for bracket tournaments.');
  }

  // Check if matches already exist
  // I don't want to create duplicate matches
  const existingMatchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId)
  );
  const existingMatchesSnap = await getDocs(existingMatchesQuery);
  if (existingMatchesSnap.size > 0) {
    throw new Error('Matches already exist for this tournament. Delete existing matches first to regenerate.');
  }

  // Get all active members (participants)
  const membersQuery = query(
    collection(db, 'leagueMembers'),
    where('leagueId', '==', leagueId),
    where('status', '==', 'active')
  );
  const membersSnap = await getDocs(membersQuery);
  const members = membersSnap.docs.map(d => d.data());
  
  // Need at least 2 people to have a tournament
  if (members.length < 2) {
    throw new Error('Need at least 2 participants to generate matches.');
  }

  // Shuffle members for random seeding
  // This makes the tournament fair by randomizing who plays who
  // Math.random() docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
  const shuffledMembers = [...members].sort(() => Math.random() - 0.5);
  
  // Calculate how many rounds I need
  // For a single-elimination tournament, if you have 8 players, you need 3 rounds:
  // Round 1: 8 players -> 4 matches -> 4 winners
  // Round 2: 4 players -> 2 matches -> 2 winners
  // Round 3: 2 players -> 1 match -> 1 winner
  // Formula: log2(number of players), rounded up
  // Math.log2() docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log2
  const numParticipants = shuffledMembers.length;
  const numRounds = Math.ceil(Math.log2(numParticipants));
  
  // Calculate how many matches I need in the first round
  // If I have 8 players, I need 4 matches (8 / 2 = 4)
  // If I have 7 players, I need 3 matches (7 / 2 = 3, with 1 bye)
  const firstRoundMatches = Math.floor(numParticipants / 2);
  const byes = numParticipants - (firstRoundMatches * 2); // Players who get a free pass

  // Create first round matches
  let matchNumber = 1;
  const matchesToCreate: any[] = [];

  // Pair up players for the first round
  // Player 1 vs Player 2, Player 3 vs Player 4, etc.
  for (let i = 0; i < firstRoundMatches; i++) {
    const player1 = shuffledMembers[i * 2];
    const player2 = shuffledMembers[i * 2 + 1];
    
    // Create a match between these two players
    matchesToCreate.push({
      leagueId,
      round: 1, // First round
      matchNumber: matchNumber++,
      player1Id: player1.userId,
      player2Id: player2.userId,
      status: 'pending' as MatchStatus, // Match hasn't been played yet
      createdAt: serverTimestamp(), // When this match was created
    });
  }

  // Handle byes (players who get a free pass to the next round)
  // This happens when there's an odd number of players
  // Example: 7 players = 3 matches + 1 bye
  if (byes > 0) {
    for (let i = 0; i < byes; i++) {
      const player = shuffledMembers[firstRoundMatches * 2 + i];
      // Create a "bye" match where the player automatically wins
      matchesToCreate.push({
        leagueId,
        round: 1,
        matchNumber: matchNumber++,
        player1Id: player.userId,
        player2Id: null, // No opponent = bye
        status: 'completed' as MatchStatus, // Already completed (they won automatically)
        result: {
          winnerId: player.userId, // They're the winner
          player1Score: 1,
          player2Score: 0,
        },
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
  }

  // Create placeholder matches for subsequent rounds
  // These matches don't have players yet - they'll be filled as winners advance
  // Example: Round 2 will have matches for "Winner of Match 1 vs Winner of Match 2"
  if (tournamentFormat === 'single_elimination') {
    let currentRoundMatches = firstRoundMatches + byes; // How many players advance from round 1
    let currentRound = 2; // Start with round 2
    
    // Keep creating rounds until I get to the final (1 match left)
    while (currentRoundMatches > 1) {
      // Each round has half as many matches as the previous round
      const nextRoundMatches = Math.ceil(currentRoundMatches / 2);
      let nextMatchNumber = 1;
      
      // Create all matches for this round
      for (let i = 0; i < nextRoundMatches; i++) {
        matchesToCreate.push({
          leagueId,
          round: currentRound,
          matchNumber: nextMatchNumber++,
          player1Id: null, // Will be filled by winner of previous round match
          player2Id: null, // Will be filled by winner of previous round match
          status: 'pending' as MatchStatus,
          createdAt: serverTimestamp(),
        });
      }
      
      // Move to the next round
      currentRoundMatches = nextRoundMatches;
      currentRound++;
    }
  }

  // Save all matches to Firestore
  // I create each match as a separate document in the tournamentMatches collection
  const matchesCollection = collection(db, 'tournamentMatches');
  for (const matchData of matchesToCreate) {
    // Create a unique ID for each match: leagueId_round_matchNumber
    // Example: "league123_r1_m1" (league 123, round 1, match 1)
    const matchId = `${leagueId}_r${matchData.round}_m${matchData.matchNumber}`;
    const matchRef = doc(matchesCollection, matchId);
    await setDoc(matchRef, {
      id: matchId,
      ...matchData,
    });
  }
}

// Get Tournament Standings
// This function calculates the leaderboard for a tournament.
// It counts wins and losses for each player and calculates their win rate.
// How it works:
// 1. Gets all active members
// 2. Gets all completed matches
// 3. For each member, counts how many matches they won
// 4. For each member, counts how many matches they lost
// 5. Calculates win rate (wins / total matches * 100)
// 6. Sorts by wins (most wins first), then by win rate
// @param leagueId - The unique ID of the league/tournament
// @returns Array of members with their win/loss stats, sorted by performance
export async function getTournamentStandings(leagueId: string) {
  // Get all active members of the league
  const membersQuery = query(
    collection(db, 'leagueMembers'),
    where('leagueId', '==', leagueId),
    where('status', '==', 'active')
  );
  
  const membersSnap = await getDocs(membersQuery);
  const members = membersSnap.docs.map(d => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // Get all completed matches
  // I only count completed matches because pending matches don't have winners yet
  const matchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId),
    where('status', '==', 'completed')
  );
  
  const matchesSnap = await getDocs(matchesQuery);
  const matches = matchesSnap.docs.map(d => d.data() as any);

  // Calculate standings for each member
  const standings = members.map(member => {
    // Count wins: matches where this member is the winner
    const wins = matches.filter(
      m => m.result?.winnerId === member.userId
    ).length;
    
    // Count losses: matches where this member played but didn't win
    const losses = matches.filter(
      m => (m.player1Id === member.userId || m.player2Id === member.userId) && // They played in this match
           m.result?.winnerId !== member.userId && // But they didn't win
           m.status === 'completed' // And the match is completed
    ).length;

    // Calculate win rate percentage
    // If they've played 10 matches and won 7, their win rate is 70%
    // Array.filter() docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
    return {
      ...member, // Include all member data (userId, displayName, etc.)
      wins,
      losses,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0, // Calculate percentage
    };
  });

  // Sort by wins (most wins first), then by win rate (highest win rate first)
  // Array.sort() docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
  return standings.sort((a, b) => {
    // First compare by wins
    if (b.wins !== a.wins) return b.wins - a.wins; // More wins = better
    // If wins are equal, compare by win rate
    return b.winRate - a.winRate; // Higher win rate = better
  });
}

// Add Dummy Tournament Data created ysing chatgpt https://chatgpt.com/share/691d9c29-51dc-8007-89a4-3ece7fb2cada
// This function adds dummy tournament data to a league for testing purposes.
// It creates 8 dummy members and a complete single-elimination bracket with results.
// @param leagueId - The unique ID of the league to add dummy data to
// @throws Error if user not signed in, not owner/admin, or league not found
export async function addDummyTournamentData(leagueId: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  // Get the league document
  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);
  
  if (!leagueSnap.exists()) {
    throw new Error('League not found.');
  }

  const leagueData = leagueSnap.data();
  
  // Check if the user is the owner or an admin
  const isOwner = leagueData.ownerId === current.uid;
  const isAdmin = Array.isArray(leagueData.admins) && leagueData.admins.includes(current.uid);
  if (!isOwner && !isAdmin) {
    throw new Error('Only league owners and admins can add dummy data.');
  }

  // Update league to be single-elimination if needed
  if (leagueData.tournamentFormat !== 'single_elimination') {
    await updateDoc(leagueRef, {
      tournamentFormat: 'single_elimination',
      numberOfRounds: 3,
      maxParticipants: 8,
    });
  }

  // Create 8 dummy members
  const dummyUserIds = [
    'dummy_user_1',
    'dummy_user_2',
    'dummy_user_3',
    'dummy_user_4',
    'dummy_user_5',
    'dummy_user_6',
    'dummy_user_7',
    'dummy_user_8',
  ];

  const dummyNames = [
    'Alice',
    'Bob',
    'Charlie',
    'Diana',
    'Eve',
    'Frank',
    'Grace',
    'Henry',
  ];

  for (let i = 0; i < dummyUserIds.length; i++) {
    const memberId = `${leagueId}_${dummyUserIds[i]}`;
    const memberRef = doc(db, 'leagueMembers', memberId);
    
    // Check if member already exists
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      await setDoc(memberRef, {
        id: memberId,
        leagueId,
        userId: dummyUserIds[i],
        role: 'member',
        status: 'active',
        displayName: dummyNames[i],
        username: dummyNames[i].toLowerCase(),
        joinedAt: serverTimestamp(),
        addedBy: current.uid,
      });
    }
  }

  // Check if matches already exist
  const existingMatchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId)
  );
  const existingMatchesSnap = await getDocs(existingMatchesQuery);
  if (existingMatchesSnap.size > 0) {
    throw new Error('Matches already exist for this tournament. Delete existing matches first.');
  }

  // Create tournament matches for a single-elimination bracket with 8 players
  const matchesCollection = collection(db, 'tournamentMatches');

  // Round 1 Matches
  const round1Matches = [
    { matchNumber: 1, player1Id: dummyUserIds[0], player2Id: dummyUserIds[1], winnerId: dummyUserIds[0], player1Score: 3, player2Score: 1 },
    { matchNumber: 2, player1Id: dummyUserIds[2], player2Id: dummyUserIds[3], winnerId: dummyUserIds[3], player1Score: 0, player2Score: 2 },
    { matchNumber: 3, player1Id: dummyUserIds[4], player2Id: dummyUserIds[5], winnerId: dummyUserIds[4], player1Score: 5, player2Score: 3 },
    { matchNumber: 4, player1Id: dummyUserIds[6], player2Id: dummyUserIds[7], winnerId: dummyUserIds[7], player1Score: 1, player2Score: 4 },
  ];

  // Round 2 Matches (semi-finals)
  const round2Matches = [
    { matchNumber: 1, player1Id: dummyUserIds[0], player2Id: dummyUserIds[3], winnerId: dummyUserIds[0], player1Score: 4, player2Score: 2 },
    { matchNumber: 2, player1Id: dummyUserIds[4], player2Id: dummyUserIds[7], winnerId: dummyUserIds[4], player1Score: 3, player2Score: 1 },
  ];

  // Round 3 Match (final)
  const round3Match = { matchNumber: 1, player1Id: dummyUserIds[0], player2Id: dummyUserIds[4], winnerId: dummyUserIds[0], player1Score: 5, player2Score: 3 };

  // Create Round 1 matches
  for (const match of round1Matches) {
    const matchId = `${leagueId}_r1_m${match.matchNumber}`;
    const matchRef = doc(matchesCollection, matchId);
    await setDoc(matchRef, {
      id: matchId,
      leagueId,
      round: 1,
      matchNumber: match.matchNumber,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      status: 'completed' as MatchStatus,
      result: {
        winnerId: match.winnerId,
        player1Score: match.player1Score,
        player2Score: match.player2Score,
      },
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  // Create Round 2 matches
  for (const match of round2Matches) {
    const matchId = `${leagueId}_r2_m${match.matchNumber}`;
    const matchRef = doc(matchesCollection, matchId);
    await setDoc(matchRef, {
      id: matchId,
      leagueId,
      round: 2,
      matchNumber: match.matchNumber,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      status: 'completed' as MatchStatus,
      result: {
        winnerId: match.winnerId,
        player1Score: match.player1Score,
        player2Score: match.player2Score,
      },
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  // Create Round 3 (Final) match
  const finalMatchId = `${leagueId}_r3_m1`;
  const finalMatchRef = doc(matchesCollection, finalMatchId);
  await setDoc(finalMatchRef, {
    id: finalMatchId,
    leagueId,
    round: 3,
    matchNumber: 1,
    player1Id: round3Match.player1Id,
    player2Id: round3Match.player2Id,
    status: 'completed' as MatchStatus,
    result: {
      winnerId: round3Match.winnerId,
      player1Score: round3Match.player1Score,
      player2Score: round3Match.player2Score,
    },
    completedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}
