import { collection, doc, getDocs, query, setDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../FirebaseConfig';

/**
 * Script to add dummy tournament data to a league
 * This creates:
 * - 8 dummy members (if needed)
 * - Tournament matches for a single-elimination bracket
 * - Match results so the bracket displays properly
 */

async function addDummyTournamentData() {
  try {
    // Get the current user (must be signed in)
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('You must be signed in to run this script');
      return;
    }

    console.log('Finding or creating a league...');

    // Find the first league, or create one if none exist
    const leaguesQuery = query(collection(db, 'leagues'));
    const leaguesSnap = await getDocs(leaguesQuery);
    
    let leagueId: string;
    let leagueRef;

    if (leaguesSnap.empty) {
      // Create a new league
      console.log('No leagues found. Creating a new league...');
      leagueRef = doc(collection(db, 'leagues'));
      leagueId = leagueRef.id;
      
      await setDoc(leagueRef, {
        name: 'Dummy Tournament League',
        game: 'Test Game',
        ownerId: currentUser.uid,
        tournamentFormat: 'single_elimination',
        numberOfRounds: 3,
        maxParticipants: 8,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`Created league: ${leagueId}`);
    } else {
      // Use the first league
      const firstLeague = leaguesSnap.docs[0];
      leagueId = firstLeague.id;
      leagueRef = firstLeague.ref;
      
      // Update it to be a single-elimination tournament
      await updateDoc(leagueRef, {
        tournamentFormat: 'single_elimination',
        numberOfRounds: 3,
      });
      console.log(`Using existing league: ${leagueId}`);
    }

    // Create 8 dummy members (players)
    console.log('Creating dummy members...');
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
      
      await setDoc(memberRef, {
        id: memberId,
        leagueId,
        userId: dummyUserIds[i],
        role: 'member',
        status: 'active',
        displayName: dummyNames[i],
        username: dummyNames[i].toLowerCase(),
        joinedAt: serverTimestamp(),
        addedBy: currentUser.uid,
      });
    }
    console.log('Created 8 dummy members');

    // Create tournament matches for a single-elimination bracket with 8 players
    // Round 1: 4 matches (8 players -> 4 winners)
    // Round 2: 2 matches (4 players -> 2 winners)
    // Round 3: 1 match (2 players -> 1 winner)

    console.log('Creating tournament matches...');

    // Round 1 Matches
    const round1Matches = [
      {
        matchNumber: 1,
        player1Id: dummyUserIds[0], // Alice
        player2Id: dummyUserIds[1], // Bob
        winnerId: dummyUserIds[0], // Alice wins
        player1Score: 3,
        player2Score: 1,
      },
      {
        matchNumber: 2,
        player1Id: dummyUserIds[2], // Charlie
        player2Id: dummyUserIds[3], // Diana
        winnerId: dummyUserIds[3], // Diana wins
        player1Score: 0,
        player2Score: 2,
      },
      {
        matchNumber: 3,
        player1Id: dummyUserIds[4], // Eve
        player2Id: dummyUserIds[5], // Frank
        winnerId: dummyUserIds[4], // Eve wins
        player1Score: 5,
        player2Score: 3,
      },
      {
        matchNumber: 4,
        player1Id: dummyUserIds[6], // Grace
        player2Id: dummyUserIds[7], // Henry
        winnerId: dummyUserIds[7], // Henry wins
        player1Score: 1,
        player2Score: 4,
      },
    ];

    // Round 2 Matches (semi-finals)
    const round2Matches = [
      {
        matchNumber: 1,
        player1Id: dummyUserIds[0], // Alice (winner of match 1)
        player2Id: dummyUserIds[3], // Diana (winner of match 2)
        winnerId: dummyUserIds[0], // Alice wins
        player1Score: 4,
        player2Score: 2,
      },
      {
        matchNumber: 2,
        player1Id: dummyUserIds[4], // Eve (winner of match 3)
        player2Id: dummyUserIds[7], // Henry (winner of match 4)
        winnerId: dummyUserIds[4], // Eve wins
        player1Score: 3,
        player2Score: 1,
      },
    ];

    // Round 3 Match (final)
    const round3Match = {
      matchNumber: 1,
      player1Id: dummyUserIds[0], // Alice (winner of semi-final 1)
      player2Id: dummyUserIds[4], // Eve (winner of semi-final 2)
      winnerId: dummyUserIds[0], // Alice wins the tournament
      player1Score: 5,
      player2Score: 3,
    };

    // Create all matches
    const matchesCollection = collection(db, 'tournamentMatches');

    // Round 1
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
        status: 'completed',
        result: {
          winnerId: match.winnerId,
          player1Score: match.player1Score,
          player2Score: match.player2Score,
        },
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }

    // Round 2
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
        status: 'completed',
        result: {
          winnerId: match.winnerId,
          player1Score: match.player1Score,
          player2Score: match.player2Score,
        },
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }

    // Round 3 (Final)
    const finalMatchId = `${leagueId}_r3_m1`;
    const finalMatchRef = doc(matchesCollection, finalMatchId);
    await setDoc(finalMatchRef, {
      id: finalMatchId,
      leagueId,
      round: 3,
      matchNumber: 1,
      player1Id: round3Match.player1Id,
      player2Id: round3Match.player2Id,
      status: 'completed',
      result: {
        winnerId: round3Match.winnerId,
        player1Score: round3Match.player1Score,
        player2Score: round3Match.player2Score,
      },
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    console.log('✅ Successfully added dummy tournament data!');
    console.log(`League ID: ${leagueId}`);
    console.log('Tournament bracket:');
    console.log('  Round 1: 4 matches (all completed)');
    console.log('  Round 2: 2 matches (semi-finals, all completed)');
    console.log('  Round 3: 1 match (final, completed)');
    console.log('  Winner: Alice');
    console.log('\nYou can now view the bracket in the app!');

  } catch (error: any) {
    console.error('Error adding dummy data:', error);
    throw error;
  }
}

// Run the script
addDummyTournamentData()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

