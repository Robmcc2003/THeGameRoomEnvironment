
// References:
// - Firestore Real-time Listeners: https://firebase.google.com/docs/firestore/query-data/listen
// - React Hooks: https://react.dev/reference/react
// - React useRef: https://react.dev/reference/react/useRef
// - Expo Router: https://docs.expo.dev/router/introduction/

import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';

// Firestore real-time docs: https://firebase.google.com/docs/firestore/query-data/listen
import { Unsubscribe, addDoc, collection, doc, getDoc, onSnapshot as onDocSnapshot, onSnapshot, query,
  serverTimestamp, setDoc, where,
} from 'firebase/firestore';

// React hooks docs: https://react.dev/reference/react
import React, { useEffect, useRef, useState } from 'react';

// Import React Native UI components
import { ActivityIndicator, Alert, FlatList, SafeAreaView, ScrollView, TextInput, TouchableOpacity,
} from 'react-native';

// Import FB
import { auth, db } from '../../FirebaseConfig';

// Import custom components from other files
import Logo from '../../components/Logo';
import { Text, View } from '../../components/Themed';
import { styles } from '../../components/style.four';

// This defines the structure of a league object for this screen.
type League = { 
  id: string; // Unique league identifier
  name: string; // League name
  game?: string | null; // Game being played (optional)
};

// Tab Four Screen Component
// This is the "My Leagues" screen where users can create and view their own leagues.
export default function TabFourScreen() {
  const router = useRouter();

  // Component State
  // useState() creates state variables that trigger re-renders when changed.
  // React useState docs: https://react.dev/reference/react/useState
  const [leagueName, setLeagueName] = useState(''); // League name input
  const [game, setGame] = useState(''); // Game name input
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null); // Current user ID
  const [loadingLeagues, setLoadingLeagues] = useState(true); // Loading state
  const [myLeagues, setMyLeagues] = useState<League[]>([]); // List of user's leagues
  
  // League Listeners Reference
  // useRef() stores a mutable value that doesn't trigger re-renders.
  // I use it to store unsubscribe functions for each league listener.
  // This allows me to clean up listeners when leagues are removed.
  // React useRef docs: https://react.dev/reference/react/useRef
  const leagueUnsubsRef = useRef<Record<string, Unsubscribe>>({});

  // This effect listens for authentication state changes.
  // When the user signs in or out, it updates the uid state.
  // React useEffect docs: https://react.dev/reference/react/useEffect
  // Firebase Auth state listener: https://firebase.google.com/docs/auth/web/manage-users#get_the_currently_signed-in_user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return () => unsub(); // Clean up listener on unmount
  }, []);

  // This is the core real-time functionality of this screen.
  // It:
  // 1. Listens to the user's league memberships
  // 2. For each league, sets up a real-time listener
  // 3. Automatically updates when leagues change
  // 4. Cleans up listeners when user leaves leagues
  // Firestore onSnapshot docs: https://firebase.google.com/docs/firestore/query-data/listen
  useEffect(() => {
    // This function stops all league listeners and clears the reference.
    // It's called when the user signs out or when cleaning up.
    const cleanupAllLeagueListeners = () => {
      // Unsubscribe from all league listeners
      Object.values(leagueUnsubsRef.current).forEach((unsub) => unsub?.());
      // Clear the reference
      leagueUnsubsRef.current = {};
    };

    // If user is not signed in, clean up and exit without error
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
        // Get all league IDs the user is a member of
        const leagueIds = snap.docs.map((d) => d.data().leagueId as string);

        // If user has no leagues, clean up and exit
        if (leagueIds.length === 0) {
          cleanupAllLeagueListeners();
          setMyLeagues([]);
          setLoadingLeagues(false);
          return;
        }

        // Remove Listeners for Leagues User Left
        // If a league ID is in my listeners but not in the current memberships,
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
          // If I'm already listening to this league, skip it
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

            // Get league data
            const data = ld.data() as any;
            const updated = { id: ld.id, name: data.name, game: data.game ?? null } as League;

            // Update League in State
            // this either merges or replaces the league in my state array.
            // If it's new, I add it. If it exists, I update it.
            setMyLeagues((prev) => {
              const i = prev.findIndex((L) => L.id === id);
              if (i === -1) return [...prev, updated]; // Add new league
              const copy = [...prev];
              copy[i] = updated; // Update existing league
              return copy;
            });
            
            setLoadingLeagues(false);
          });

          // Store the unsubscribe function so I can clean it up later
          leagueUnsubsRef.current[id] = unsub;
        });
      },
      (error) => {
        console.error('Membership listener error:', error);
        setLoadingLeagues(false);
      }
    );

    // When the component unmounts or the effect re-runs, it needs to:
    // 1. Stop listening to memberships
    // 2. Stop listening to all leagues
    // This prevents memory leaks.
    return () => {
      unsubscribeMemberships();
      cleanupAllLeagueListeners();
    };
  }, [uid]); // Re-run when user ID changes

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
      // Create new league document in Firestore
      // addDoc() automatically generates a unique document ID to identufy different leagues
      const leagueRef = await addDoc(collection(db, 'leagues'), {
        name: leagueName.trim(),
        game: game.trim() || null,
        ownerId: uid,
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp(),
      });

      // Get user profile for display name
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const displayName = userData?.displayName || userData?.username || auth.currentUser?.email?.split('@')[0] || 'Player';
      const username = userData?.username || null;

      // Add creator as a member of the league
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

      // Navigate to the new league's detail page
      router.push({
        pathname: '/league/[leagueId]',
        params: { leagueId: leagueRef.id },
      });
    } catch (error: any) {
      console.error('Failed to create league:', error);
      Alert.alert('Error', 'Failed to create league: ' + (error?.message || 'Unknown error'));
    }
  };
//predominantly styling and UI structure below
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.logoSection}>
          <Logo size="small" showTagline={false} />
        </View>

        <Text style={styles.mainTitle}>My Leagues</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="League Name"
            placeholderTextColor="#999999"
            value={leagueName}
            onChangeText={setLeagueName}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Game (Optional)"
            placeholderTextColor="#999999"
            value={game}
            onChangeText={setGame}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleCreateLeague}>
          <Text style={styles.buttonText}>Create League</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>My Leagues</Text>

        {loadingLeagues ? (
          <ActivityIndicator size="large" color="#DC143C" style={{ marginTop: 20 }} />
        ) : myLeagues.length === 0 ? (
          <Text style={styles.emptyText}>You haven't joined any leagues yet.</Text>
        ) : (
          <FlatList
            data={myLeagues}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.leagueItem}
                onPress={() => {
                  router.push({
                    pathname: '/league/[leagueId]',
                    params: { leagueId: item.id },
                  });
                }}
              >
                <Text style={styles.leagueName}>{item.name}</Text>
                {item.game && (
                  <Text style={styles.leagueGame}>{item.game}</Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 
