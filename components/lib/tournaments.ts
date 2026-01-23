import { auth, db } from '../../FirebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export type MatchResult = {
  player1Score?: number;
  player2Score?: number;
  winnerId?: string;
  verified?: boolean; // Whether the score has been verified by an admin
  submittedBy?: string; // User ID who submitted the score
  verifiedBy?: string; // User ID who verified the score
  verifiedAt?: any; // Timestamp when verified
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

/* User joining tournament code (lines 37-101) uses Firestore setDoc - https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document */
export async function joinTournament(leagueId: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);
  
  if (!leagueSnap.exists()) {
    throw new Error('League not found.');
  }

  const leagueData = leagueSnap.data();
  
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

  const memberId = `${leagueId}_${current.uid}`;
  const memberRef = doc(db, 'leagueMembers', memberId);
  const memberSnap = await getDoc(memberRef);

  if (memberSnap.exists()) {
    throw new Error('You are already a member of this tournament.');
  }

  const userRef = doc(db, 'users', current.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : null;
  const displayName = userData?.displayName || userData?.username || current.email?.split('@')[0] || 'Player';
  const username = userData?.username || null;

  await setDoc(memberRef, {
    id: memberId,
    leagueId,
    userId: current.uid,
    role: 'member',
    status: 'active',
    displayName: displayName,
    username: username,
    joinedAt: serverTimestamp(),
    addedBy: current.uid,
  });

  await autoGenerateBracketIfNeeded(leagueId);
}

// I retrieve all matches for a tournament and organise them into a bracket.
// i used chatgpt to adapt the logic for generating the tournament bracket from user data https://chatgpt.com/share/6973b4c9-23c8-8007-98f1-d6533d1d01fe
// it returns the matches sorted by round and match number, plus information about
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
  
  const matchesSnap = await getDocs(matchesQuery);
  const matches: Match[] = matchesSnap.docs.map(d => ({
    id: d.id,
    ...(d.data() as any),
  }));

  if (matches.length === 0) {
    return null;
  }

  const rounds = Math.max(...matches.map(m => m.round || 0), 0);
  
  const currentRound = Math.min(
    ...matches
      .filter(m => m.status !== 'completed')
      .map(m => m.round || 0),
    rounds
  );

  return {
    matches: matches.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return (a.matchNumber || 0) - (b.matchNumber || 0);
    }),
    rounds,
    currentRound: currentRound || 1,
  };
}

// I automatically generate brackets when tournament format is set, there are at least 2 members, and no matches exist yet.
export async function autoGenerateBracketIfNeeded(leagueId: string): Promise<boolean> {
  try {
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (!leagueSnap.exists()) {
      return false;
    }

    const leagueData = leagueSnap.data();
    const tournamentFormat = leagueData.tournamentFormat;
    
    if (tournamentFormat !== 'single_elimination' && tournamentFormat !== 'double_elimination') {
      return false;
    }

    const existingMatchesQuery = query(
      collection(db, 'tournamentMatches'),
      where('leagueId', '==', leagueId)
    );
    const existingMatchesSnap = await getDocs(existingMatchesQuery);
    if (existingMatchesSnap.size > 0) {
      return false;
    }

    const membersQuery = query(
      collection(db, 'leagueMembers'),
      where('leagueId', '==', leagueId),
      where('status', '==', 'active')
    );
    const membersSnap = await getDocs(membersQuery);
    const members = membersSnap.docs.map(d => d.data());
    
    if (members.length < 2) {
      return false;
    }

    await generateBracketMatchesInternal(leagueId, tournamentFormat, members);
    return true;
  } catch (error) {
    return false;
  }
}

/* Internal bracket generation logic used by both manual and automatic generation */
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

/* Bracket generation algorithm (lines 180-274) is based on single-elimination tournament theory - */
/* I adapted the algorithm to handle byes and create placeholder matches for subsequent rounds */
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

  // Get all completed matches with verified scores
  // Only count verified matches because unverified scores shouldn't affect standings
  const matchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId),
    where('status', '==', 'completed')
  );
  
  const matchesSnap = await getDocs(matchesQuery);
  const matches = matchesSnap.docs.map(d => d.data() as any);

  // Filter to only verified matches
  const verifiedMatches = matches.filter(m => m.result?.verified === true);

  // Calculate standings for each member
  const standings = members.map(member => {
    // Count wins: verified matches where this member is the winner
    const wins = verifiedMatches.filter(
      m => m.result?.winnerId === member.userId
    ).length;
    
    // Count losses: verified matches where this member played but didn't win
    const losses = verifiedMatches.filter(
      m => (m.player1Id === member.userId || m.player2Id === member.userId) && // They played in this match
           m.result?.winnerId !== member.userId && // But they didn't win
           m.result?.verified === true // And the match is verified
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
// This function allows any user to submit scores for matches they're in.
// Scores are marked as unverified until an admin verifies them.
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
  const oldWinnerId = matchData.result?.verified ? matchData.result?.winnerId : null; // Only consider verified winners

  // Check if user is a player in this match
  const isPlayer1 = matchData.player1Id === current.uid;
  const isPlayer2 = matchData.player2Id === current.uid;
  
  if (!isPlayer1 && !isPlayer2) {
    // Check if user is admin/owner (they can submit scores for any match)
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (!leagueSnap.exists()) {
      throw new Error('League not found.');
    }

    const leagueData = leagueSnap.data();
    const isOwner = leagueData.ownerId === current.uid;
    const isAdmin = Array.isArray(leagueData.admins) && leagueData.admins.includes(current.uid);
    
    const userRef = doc(db, 'users', current.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : null;
    const isUserAdmin = userData?.role === 'admin';
    
    if (!isOwner && !isAdmin && !isUserAdmin) {
      throw new Error('You can only submit scores for matches you are playing in.');
    }
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

  // Update the match with unverified scores
  // Only cascade winner advancement if this is verified (handled in verifyMatchScore)
  await updateDoc(matchRef, {
    status: 'completed' as MatchStatus,
    result: {
      player1Score,
      player2Score,
      winnerId: winnerId || undefined,
      verified: false, // Mark as unverified
      submittedBy: current.uid,
      verifiedBy: undefined,
      verifiedAt: undefined,
    },
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Verify Match Score
// This function allows admins to verify submitted scores.
// Once verified, the winner is advanced through the bracket.
export async function verifyMatchScore(matchId: string): Promise<void> {
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
  const oldWinnerId = matchData.result?.verified ? matchData.result?.winnerId : null;

  // Check if match has scores to verify
  if (!matchData.result || matchData.result.verified) {
    throw new Error('Match has no unverified scores to verify.');
  }

  // Get the league to check admin permissions
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
    throw new Error('Only league owners, admins, or system admins can verify match scores.');
  }

  const newWinnerId = matchData.result.winnerId;

  // If there was a previous verified winner and it's different from the new winner, 
  // we need to cascade the removal through ALL subsequent rounds
  if (oldWinnerId && oldWinnerId !== newWinnerId) {
    await cascadeRemoveWinner(leagueId, currentRound, currentMatchNumber, oldWinnerId);
  }

  // Mark the score as verified
  await updateDoc(matchRef, {
    result: {
      ...matchData.result,
      verified: true,
      verifiedBy: current.uid,
      verifiedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });

  // Advance winner to next round if there is a winner, and cascade through all rounds
  // Only do this for verified scores
  if (newWinnerId) {
    await cascadeAdvanceWinner(leagueId, currentRound, currentMatchNumber, newWinnerId);
  }
}

// Cascade Remove Winner Through All Rounds
// This function removes a player from all subsequent rounds when a match score is changed.
// It cascades through the entire bracket to ensure consistency.
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
        const completedWinnerId = nextMatchData.result?.verified 
          ? nextMatchData.result?.winnerId 
          : null;
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
      // Both players are set - check if match is completed and verified
      if (updatedNextMatchData.status === 'completed' && 
          updatedNextMatchData.result?.winnerId && 
          updatedNextMatchData.result?.verified) {
        // Match already has a verified winner - advance that winner to the next round
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
// It's optimised to only calculate stats for one user rather than all members.
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
  
  // Upcoming matches are those that are pending or in progress
  const upcomingMatches = userMatches.filter(m => m.status === 'pending' || m.status === 'in_progress').length;
  // Completed matches are those that are completed (verified or not)
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

// Get User Overall Stats
// This function calculates a user's overall statistics across all tournaments they've participated in
export async function getUserOverallStats(userId: string): Promise<{
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  overallWinRate: number;
  tournamentsParticipated: number;
  tournamentsWon: number;
}> {
  // Get all leagues the user is a member of
  const membersQuery = query(
    collection(db, 'leagueMembers'),
    where('userId', '==', userId),
    where('status', '==', 'active')
  );
  const membersSnap = await getDocs(membersQuery);
  const leagueIds = membersSnap.docs.map(d => d.data().leagueId);

  if (leagueIds.length === 0) {
    return {
      totalWins: 0,
      totalLosses: 0,
      totalMatches: 0,
      overallWinRate: 0,
      tournamentsParticipated: 0,
      tournamentsWon: 0,
    };
  }

  // Get all completed matches across all user's leagues
  let totalWins = 0;
  let totalLosses = 0;
  const tournamentResults: { leagueId: string; won: boolean }[] = [];

  for (const leagueId of leagueIds) {
    const matchesQuery = query(
      collection(db, 'tournamentMatches'),
      where('leagueId', '==', leagueId),
      where('status', '==', 'completed')
    );
    const matchesSnap = await getDocs(matchesQuery);
    const matches = matchesSnap.docs.map(d => d.data() as any);

    // Count wins and losses for this league
    const wins = matches.filter(m => m.result?.winnerId === userId).length;
    const losses = matches.filter(
      m => (m.player1Id === userId || m.player2Id === userId) &&
           m.result?.winnerId !== userId &&
           m.result?.winnerId // Match must have a winner
    ).length;

    totalWins += wins;
    totalLosses += losses;

    // Check if user won the tournament (they're the winner of the final match)
    const finalMatch = matches
      .filter(m => m.round === 1 && m.matchNumber === 1)
      .find(m => m.status === 'completed');
    
    if (finalMatch && finalMatch.result?.winnerId === userId) {
      tournamentResults.push({ leagueId, won: true });
    } else if (matches.length > 0) {
      tournamentResults.push({ leagueId, won: false });
    }
  }

  const totalMatches = totalWins + totalLosses;
  const overallWinRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

  return {
    totalWins,
    totalLosses,
    totalMatches,
    overallWinRate,
    tournamentsParticipated: leagueIds.length,
    tournamentsWon: tournamentResults.filter(r => r.won).length,
  };
}

// Get User Tournament History
// This function retrieves all tournaments a user has participated in with their results
export async function getUserTournamentHistory(userId: string): Promise<Array<{
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
}>> {
  // Get all leagues the user is a member of
  const membersQuery = query(
    collection(db, 'leagueMembers'),
    where('userId', '==', userId),
    where('status', '==', 'active')
  );
  const membersSnap = await getDocs(membersQuery);
  const members = membersSnap.docs.map(d => ({
    leagueId: d.data().leagueId,
    joinedAt: d.data().joinedAt,
  }));

  const history: Array<{
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
  }> = [];

  // For each league, get the user's stats
  for (const member of members) {
    try {
      // Get league info
      const leagueRef = doc(db, 'leagues', member.leagueId);
      const leagueSnap = await getDoc(leagueRef);
      
      if (!leagueSnap.exists()) continue;

      const leagueData = leagueSnap.data();
      
      // Include all tournament format leagues (single_elimination, double_elimination, round_robin, etc.)
      // Check if it's any tournament format, not just 'tournament'
      const isTournamentFormat = leagueData.tournamentFormat === 'tournament' ||
        leagueData.tournamentFormat === 'single_elimination' ||
        leagueData.tournamentFormat === 'double_elimination' ||
        leagueData.tournamentFormat === 'round_robin';
      
      if (!isTournamentFormat) continue;

      // Get user's progress in this tournament
      const progress = await getUserProgress(member.leagueId, userId);
      
      if (!progress) continue;

      // Check if tournament has final round matches with scores entered
      // Round 1 is the final round (championship match)
      const finalMatchesQuery = query(
        collection(db, 'tournamentMatches'),
        where('leagueId', '==', member.leagueId),
        where('round', '==', 1)
      );
      const finalMatchesSnap = await getDocs(finalMatchesQuery);
      const finalMatches = finalMatchesSnap.docs.map(d => d.data() as any);
      
      // Tournament is considered historical if:
      // 1. There are final round matches AND at least one has scores entered, OR
      // 2. The league has an endDate set (tournament was marked as completed)
      const hasFinalRoundScores = finalMatches.length > 0 && 
        finalMatches.some(m => m.status === 'completed' && m.result && 
          (m.result.player1Score !== undefined || m.result.player2Score !== undefined));
      
      // Check if league has an endDate (tournament completion date)
      const hasEndDate = leagueData.endDate && leagueData.endDate.trim() !== '';
      
      // Get completion time from:
      // 1. Most recent completed final match with scores, OR
      // 2. League endDate if set
      let completedAt: any = undefined;
      
      if (hasFinalRoundScores) {
        const completedFinalMatches = finalMatches.filter(
          m => m.status === 'completed' && 
          m.completedAt && 
          m.result &&
          (m.result.player1Score !== undefined || m.result.player2Score !== undefined)
        );
        
        if (completedFinalMatches.length > 0) {
          completedAt = completedFinalMatches.sort((a, b) => {
            const aTime = a.completedAt?.toMillis?.() || 0;
            const bTime = b.completedAt?.toMillis?.() || 0;
            return bTime - aTime; // Most recent first
          })[0]?.completedAt;
        }
      }
      
      // If no match completion date but endDate is set, use that
      if (!completedAt && hasEndDate) {
        try {
          // Parse the endDate string (assuming format like "YYYY-MM-DD" or similar)
          const endDateObj = new Date(leagueData.endDate);
          if (!isNaN(endDateObj.getTime())) {
            completedAt = { toMillis: () => endDateObj.getTime() };
          }
        } catch (e) {
        }
      }
      
      // Include tournaments where:
      // 1. User has played matches (has progress), OR
      // 2. Final round has scores entered, OR
      // 3. Tournament has an endDate set (marked as completed)
      if (!hasFinalRoundScores && !hasEndDate && progress.totalMatches === 0) {
        // Skip tournaments with no matches, no final round scores, and no endDate
        continue;
      }

      history.push({
        leagueId: member.leagueId,
        leagueName: leagueData.name || 'Unnamed Tournament',
        format: leagueData.tournamentFormat || 'tournament',
        position: progress.position,
        wins: progress.wins,
        losses: progress.losses,
        winRate: progress.winRate,
        totalMatches: progress.totalMatches,
        completedAt: completedAt,
        joinedAt: member.joinedAt,
      });
    } catch (error) {
      continue;
    }
  }

  // Sort by completion date (most recent first), then by joined date
  return history.sort((a, b) => {
    const aDate = a.completedAt?.toMillis?.() || a.joinedAt?.toMillis?.() || 0;
    const bDate = b.completedAt?.toMillis?.() || b.joinedAt?.toMillis?.() || 0;
    return bDate - aDate; // Most recent first
  });
}
