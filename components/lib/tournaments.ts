// Tournament Functions Library
// Contains functions for joining tournaments, getting brackets, and calculating standings

import { auth, db } from '../../FirebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

// Tournament status types
export type TournamentStatus = 'pending' | 'active' | 'completed';

// Match status types
export type MatchStatus = 'pending' | 'in_progress' | 'completed';

// Match result data structure
export type MatchResult = {
  player1Score?: number;
  player2Score?: number;
  winnerId?: string;
};

// Match data structure
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

// Tournament bracket data structure
export type TournamentBracket = {
  matches: Match[];
  rounds: number;
  currentRound: number;
};

// Join a tournament/league as a player
// Checks if league exists, if there's space, and if user is already a member
export async function joinTournament(leagueId: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  // Get league document
  const leagueRef = doc(db, 'leagues', leagueId);
  const leagueSnap = await getDoc(leagueRef);
  
  if (!leagueSnap.exists()) {
    throw new Error('League not found.');
  }

  const leagueData = leagueSnap.data();
  
  // Check if league has a maximum number of participants
  if (leagueData.maxParticipants) {
    // Count current active members
    const membersQuery = query(
      collection(db, 'leagueMembers'),
      where('leagueId', '==', leagueId),
      where('status', '==', 'active')
    );
    const membersSnap = await getDocs(membersQuery);
    
    // If league is full, throw error
    if (membersSnap.size >= leagueData.maxParticipants) {
      throw new Error('Tournament is full. Maximum participants reached.');
    }
  }

  // Check if user is already a member
  const memberId = `${leagueId}_${current.uid}`;
  const memberRef = doc(db, 'leagueMembers', memberId);
  const memberSnap = await getDoc(memberRef);

  if (memberSnap.exists()) {
    throw new Error('You are already a member of this tournament.');
  }

  // Add user as a member of the league
  await setDoc(memberRef, {
    id: memberId,
    leagueId,
    userId: current.uid,
    role: 'member',
    status: 'active',
    joinedAt: serverTimestamp(),
    addedBy: current.uid,
  });
}

// Get tournament bracket with all matches
// Returns matches organized by round and match number
export async function getTournamentBracket(leagueId: string): Promise<TournamentBracket | null> {
  // Get all matches for this league
  const matchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId)
  );
  
  const matchesSnap = await getDocs(matchesQuery);
  const matches: Match[] = matchesSnap.docs.map(d => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // If no matches, return null
  if (matches.length === 0) {
    return null;
  }

  // Calculate total rounds and current round
  const rounds = Math.max(...matches.map(m => m.round || 0), 0);
  const currentRound = Math.min(
    ...matches
      .filter(m => m.status !== 'completed')
      .map(m => m.round || 0),
    rounds
  );

  // Return bracket with sorted matches
  return {
    matches: matches.sort((a, b) => {
      // Sort by round first, then by match number
      if (a.round !== b.round) return a.round - b.round;
      return (a.matchNumber || 0) - (b.matchNumber || 0);
    }),
    rounds,
    currentRound: currentRound || 1,
  };
}

// Get tournament standings/leaderboard
// Calculates wins, losses, and win rate for each player
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

  // Get all completed matches to calculate wins/losses
  const matchesQuery = query(
    collection(db, 'tournamentMatches'),
    where('leagueId', '==', leagueId),
    where('status', '==', 'completed')
  );
  
  const matchesSnap = await getDocs(matchesQuery);
  const matches = matchesSnap.docs.map(d => d.data() as any);

  // Calculate standings for each member
  const standings = members.map(member => {
    // Count wins (matches where this member is the winner)
    const wins = matches.filter(
      m => m.result?.winnerId === member.userId
    ).length;
    
    // Count losses (matches where this member played but didn't win)
    const losses = matches.filter(
      m => (m.player1Id === member.userId || m.player2Id === member.userId) &&
           m.result?.winnerId !== member.userId &&
           m.status === 'completed'
    ).length;

    // Calculate win rate percentage
    return {
      ...member,
      wins,
      losses,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    };
  });

  // Sort by wins (descending), then by win rate (descending)
  return standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.winRate - a.winRate;
  });
}
