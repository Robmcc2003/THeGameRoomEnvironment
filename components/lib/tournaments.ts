import { auth, db } from '../../FirebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

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

  // Auto-generate brackets if conditions are met
  // This makes the bracket tab always useful without manual intervention
  await autoGenerateBracketIfNeeded(leagueId);
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

// Auto-generate bracket matches if conditions are met
// This function automatically generates brackets when:
// - Tournament format is set (single_elimination or double_elimination)
// - There are at least 2 active members
// - No matches exist yet
// This makes the bracket tab always useful without manual intervention
// @param leagueId - The unique ID of the league/tournament
// @returns true if brackets were generated, false otherwise
export async function autoGenerateBracketIfNeeded(leagueId: string): Promise<boolean> {
  try {
    // Get the league document
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (!leagueSnap.exists()) {
      return false; // League doesn't exist
    }

    const leagueData = leagueSnap.data();
    const tournamentFormat = leagueData.tournamentFormat;
    
    // Only auto-generate for bracket tournaments
    if (tournamentFormat !== 'single_elimination' && tournamentFormat !== 'double_elimination') {
      return false; // Not a bracket tournament
    }

    // Check if matches already exist
    const existingMatchesQuery = query(
      collection(db, 'tournamentMatches'),
      where('leagueId', '==', leagueId)
    );
    const existingMatchesSnap = await getDocs(existingMatchesQuery);
    if (existingMatchesSnap.size > 0) {
      return false; // Matches already exist
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
      return false; // Not enough participants yet
    }

    // All conditions met - generate brackets automatically
    // Use the internal generation logic without permission checks
    await generateBracketMatchesInternal(leagueId, tournamentFormat, members);
    return true;
  } catch (error) {
    console.error('Error auto-generating bracket:', error);
    return false; // Fail silently for auto-generation
  }
}

// Internal bracket generation logic (without permission checks)
// This is used by both manual and automatic generation
async function generateBracketMatchesInternal(
  leagueId: string, 
  tournamentFormat: 'single_elimination' | 'double_elimination',
  members: any[]
): Promise<void> {
  // Shuffle members for random seeding
  const shuffledMembers = [...members].sort(() => Math.random() - 0.5);
  
  // Calculate how many rounds I need
  const numParticipants = shuffledMembers.length;
  const numRounds = Math.ceil(Math.log2(numParticipants));
  
  // Calculate how many matches I need in the first round
  const firstRoundMatches = Math.floor(numParticipants / 2);
  const byes = numParticipants - (firstRoundMatches * 2); // Players who get a free pass

  // Create first round matches
  let matchNumber = 1;
  const matchesToCreate: any[] = [];

  // Pair up players for the first round
  for (let i = 0; i < firstRoundMatches; i++) {
    const player1 = shuffledMembers[i * 2];
    const player2 = shuffledMembers[i * 2 + 1];
    
    matchesToCreate.push({
      leagueId,
      round: 1,
      matchNumber: matchNumber++,
      player1Id: player1.userId,
      player2Id: player2.userId,
      status: 'pending' as MatchStatus,
      createdAt: serverTimestamp(),
    });
  }

  // Handle byes (players who get a free pass to the next round)
  if (byes > 0) {
    for (let i = 0; i < byes; i++) {
      const player = shuffledMembers[firstRoundMatches * 2 + i];
      matchesToCreate.push({
        leagueId,
        round: 1,
        matchNumber: matchNumber++,
        player1Id: player.userId,
        player2Id: null, // No opponent = bye
        status: 'completed' as MatchStatus,
        result: {
          winnerId: player.userId,
          player1Score: 1,
          player2Score: 0,
        },
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
  }

  // Create placeholder matches for subsequent rounds
  if (tournamentFormat === 'single_elimination') {
    let currentRoundMatches = firstRoundMatches + byes;
    let currentRound = 2;
    
    while (currentRoundMatches > 1) {
      const nextRoundMatches = Math.ceil(currentRoundMatches / 2);
      let nextMatchNumber = 1;
      
      for (let i = 0; i < nextRoundMatches; i++) {
        matchesToCreate.push({
          leagueId,
          round: currentRound,
          matchNumber: nextMatchNumber++,
          player1Id: null,
          player2Id: null,
          status: 'pending' as MatchStatus,
          createdAt: serverTimestamp(),
        });
      }
      
      currentRoundMatches = nextRoundMatches;
      currentRound++;
    }
  }

  // Save all matches to Firestore
  const matchesCollection = collection(db, 'tournamentMatches');
  for (const matchData of matchesToCreate) {
    const matchId = `${leagueId}_r${matchData.round}_m${matchData.matchNumber}`;
    const matchRef = doc(matchesCollection, matchId);
    await setDoc(matchRef, {
      id: matchId,
      ...matchData,
    });
  }
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

  // Use the internal generation logic
  await generateBracketMatchesInternal(leagueId, tournamentFormat, members);
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

// Update Match Score
// This function updates a match with scores and determines the winner.
// @param matchId - The unique ID of the match
// @param player1Score - Score for player 1
// @param player2Score - Score for player 2
// @throws Error if user not signed in, not owner/admin, match not found, or invalid scores
export async function updateMatchScore(
  matchId: string,
  player1Score: number,
  player2Score: number
): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  // Get the match document
  const matchRef = doc(db, 'tournamentMatches', matchId);
  const matchSnap = await getDoc(matchRef);
  
  if (!matchSnap.exists()) {
    throw new Error('Match not found.');
  }

  const matchData = matchSnap.data();
  const leagueId = matchData.leagueId;
  const currentRound = matchData.round;
  const currentMatchNumber = matchData.matchNumber;
  const oldWinnerId = matchData.result?.winnerId;

  // Get the league to check permissions
  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);
  
  if (!leagueSnap.exists()) {
    throw new Error('League not found.');
  }

  const leagueData = leagueSnap.data();
  
  // Check if the user is the owner or an admin
  const isOwner = leagueData.ownerId === current.uid;
  const isAdmin = Array.isArray(leagueData.admins) && leagueData.admins.includes(current.uid);
  
  // Also check if user is an admin in their profile
  const userRef = doc(db, 'users', current.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : null;
  const isUserAdmin = userData?.role === 'admin';
  
  if (!isOwner && !isAdmin && !isUserAdmin) {
    throw new Error('Only league owners, admins, or system admins can update match scores.');
  }

  // Validate scores
  if (player1Score < 0 || player2Score < 0 || !Number.isInteger(player1Score) || !Number.isInteger(player2Score)) {
    throw new Error('Scores must be non-negative integers.');
  }

  // Determine winner
  let winnerId: string | null = null;
  if (player1Score > player2Score) {
    winnerId = matchData.player1Id;
  } else if (player2Score > player1Score) {
    winnerId = matchData.player2Id;
  }
  // If scores are equal, winner is null (tie - may need tie-breaker logic later)

  // If there was a previous winner and it's different from the new winner, 
  // we need to cascade the removal through ALL subsequent rounds
  if (oldWinnerId && oldWinnerId !== winnerId) {
    await cascadeRemoveWinner(leagueId, currentRound, currentMatchNumber, oldWinnerId);
  }

  // Update the match
  await updateDoc(matchRef, {
    status: 'completed' as MatchStatus,
    result: {
      player1Score,
      player2Score,
      winnerId: winnerId || undefined,
    },
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Advance winner to next round if there is a winner, and cascade through all rounds
  if (winnerId) {
    await cascadeAdvanceWinner(leagueId, currentRound, currentMatchNumber, winnerId);
  }
}

// Cascade Remove Winner Through All Rounds
// This function removes a player from all subsequent rounds when a match score is changed.
// It cascades through the entire bracket to ensure consistency.
// @param leagueId - The league ID
// @param currentRound - The round number of the match
// @param currentMatchNumber - The match number in the current round
// @param oldWinnerId - The user ID of the old winner to remove
async function cascadeRemoveWinner(
  leagueId: string,
  currentRound: number,
  currentMatchNumber: number,
  oldWinnerId: string
): Promise<void> {
  let round = currentRound + 1;
  let matchNumber = Math.ceil(currentMatchNumber / 2);
  let isPlayer1 = currentMatchNumber % 2 === 1;
  
  // Cascade through all subsequent rounds
  while (true) {
    const nextMatchId = `${leagueId}_r${round}_m${matchNumber}`;
    const nextMatchRef = doc(db, 'tournamentMatches', nextMatchId);
    const nextMatchSnap = await getDoc(nextMatchRef);
    
    if (!nextMatchSnap.exists()) {
      break; // No more rounds
    }
    
    const nextMatchData = nextMatchSnap.data();
    let shouldRemove = false;
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };
    
    // Check if old winner is in this match
    if (isPlayer1 && nextMatchData.player1Id === oldWinnerId) {
      updateData.player1Id = null;
      shouldRemove = true;
    } else if (!isPlayer1 && nextMatchData.player2Id === oldWinnerId) {
      updateData.player2Id = null;
      shouldRemove = true;
    }
    
    if (shouldRemove) {
      // If this match was completed, we need to cascade remove its winner from further rounds
      if (nextMatchData.status === 'completed' && nextMatchData.result?.winnerId === oldWinnerId) {
        // Clear the match result since the winner is being removed
        updateData.status = 'pending';
        updateData.result = null;
        updateData.completedAt = null;
        
        // Recursively remove this winner from all further rounds
        const removedWinnerId = nextMatchData.result.winnerId;
        await cascadeRemoveWinner(leagueId, round, matchNumber, removedWinnerId);
      } else if (nextMatchData.status === 'completed') {
        // Match was completed but with a different winner - still need to invalidate
        // because one of the players changed, so the result might be wrong
        updateData.status = 'pending';
        updateData.result = null;
        updateData.completedAt = null;
        
        // Also remove the winner of this match from further rounds
        // since the match participants changed, the result is invalid
        const completedWinnerId = nextMatchData.result?.winnerId;
        if (completedWinnerId) {
          await cascadeRemoveWinner(leagueId, round, matchNumber, completedWinnerId);
        }
      }
      
      await updateDoc(nextMatchRef, updateData);
      
      // Continue to next round to check if old winner appears there
      isPlayer1 = matchNumber % 2 === 1;
      matchNumber = Math.ceil(matchNumber / 2);
      round++;
    } else {
      // Old winner not found in this position, stop cascading
      break;
    }
  }
}

// Cascade Advance Winner Through All Rounds
// This function automatically advances the winner of a match through ALL subsequent rounds.
// It cascades through the entire bracket, recalculating winners for all affected matches.
// @param leagueId - The league ID
// @param currentRound - The round number of the completed match
// @param currentMatchNumber - The match number in the current round
// @param winnerId - The user ID of the winner
async function cascadeAdvanceWinner(
  leagueId: string,
  currentRound: number,
  currentMatchNumber: number,
  winnerId: string
): Promise<void> {
  let round = currentRound + 1;
  let matchNumber = Math.ceil(currentMatchNumber / 2);
  let isPlayer1 = currentMatchNumber % 2 === 1;
  
  // Cascade through all subsequent rounds
  while (true) {
    const nextMatchId = `${leagueId}_r${round}_m${matchNumber}`;
    const nextMatchRef = doc(db, 'tournamentMatches', nextMatchId);
    const nextMatchSnap = await getDoc(nextMatchRef);
    
    // If next round match doesn't exist, we've reached the final
    if (!nextMatchSnap.exists()) {
      break; // No more rounds
    }
    
    const nextMatchData = nextMatchSnap.data();
    
    // Check if players in this match have changed
    const playerChanged = (isPlayer1 && nextMatchData.player1Id !== winnerId) || 
                          (!isPlayer1 && nextMatchData.player2Id !== winnerId);
    
    // If players changed and match was completed, invalidate the result
    if (playerChanged && nextMatchData.status === 'completed') {
      const oldCompletedWinnerId = nextMatchData.result?.winnerId;
      
      // Clear the match result since players changed
      await updateDoc(nextMatchRef, {
        status: 'pending' as MatchStatus,
        result: null,
        completedAt: null,
        updatedAt: serverTimestamp(),
      });
      
      // If there was a winner, remove them from further rounds
      if (oldCompletedWinnerId) {
        await cascadeRemoveWinner(leagueId, round, matchNumber, oldCompletedWinnerId);
      }
    }
    
    // Update the next match with the winner
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };
    
    if (isPlayer1) {
      updateData.player1Id = winnerId;
    } else {
      updateData.player2Id = winnerId;
    }
    
    await updateDoc(nextMatchRef, updateData);
    
    // Check if both players are now set in this match
    const updatedNextMatchSnap = await getDoc(nextMatchRef);
    const updatedNextMatchData = updatedNextMatchSnap.data();
    
    if (updatedNextMatchData.player1Id && updatedNextMatchData.player2Id) {
      // Both players are set - check if match is completed
      if (updatedNextMatchData.status === 'completed' && updatedNextMatchData.result?.winnerId) {
        // Match already has a winner - advance that winner to the next round
        const nextWinnerId = updatedNextMatchData.result.winnerId;
        // Continue cascading with this winner
        isPlayer1 = matchNumber % 2 === 1;
        matchNumber = Math.ceil(matchNumber / 2);
        round++;
        winnerId = nextWinnerId;
      } else {
        // Match not completed yet - stop here (waiting for match to be played)
        break;
      }
    } else {
      // Only one player set - stop here (waiting for other player)
      break;
    }
  }
}

// Get User Progress in a League
// This function gets a specific user's progress and position in a tournament/league.
// It's optimized to only calculate stats for one user rather than all members.
// @param leagueId - The unique ID of the league/tournament
// @param userId - The unique ID of the user
// @returns Object with user's position, wins, losses, win rate, and match count, or null if not found
export async function getUserProgress(leagueId: string, userId: string): Promise<{
  position: number | null;
  wins: number;
  losses: number;
  winRate: number;
  totalMatches: number;
  upcomingMatches: number;
  completedMatches: number;
} | null> {
  // Get all standings to find user's position
  const standings = await getTournamentStandings(leagueId);
  const userStanding = standings.find(s => s.userId === userId);
  
  if (!userStanding) {
    // User might not be a member or no matches exist yet
    // Check if user is a member
    const memberQuery = query(
      collection(db, 'leagueMembers'),
      where('leagueId', '==', leagueId),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const memberSnap = await getDocs(memberQuery);
    
    if (memberSnap.empty) {
      return null; // User is not a member
    }
    
    // User is a member but has no matches yet
    return {
      position: null,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalMatches: 0,
      upcomingMatches: 0,
      completedMatches: 0,
    };
  }

  // Get all matches (not just completed) to count upcoming matches
  const allMatchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId)
  );
  const allMatchesSnap = await getDocs(allMatchesQuery);
  const allMatches = allMatchesSnap.docs.map(d => d.data() as any);
  
  // Filter user's matches
  const userMatches = allMatches.filter(
    m => m.player1Id === userId || m.player2Id === userId
  );
  
  const upcomingMatches = userMatches.filter(m => m.status === 'pending' || m.status === 'in_progress').length;
  const completedMatches = userMatches.filter(m => m.status === 'completed').length;
  
  // Find position in standings
  const position = standings.findIndex(s => s.userId === userId) + 1;

  return {
    position: position > 0 ? position : null,
    wins: userStanding.wins,
    losses: userStanding.losses,
    winRate: userStanding.winRate,
    totalMatches: userMatches.length,
    upcomingMatches,
    completedMatches,
  };
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
