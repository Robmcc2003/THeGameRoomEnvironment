// primary file for the My leagues tab 
// *****REMINDER TO DEAL WITH SAFE AREA VIEW IN A FUTURE IT AS NO LONGER SUPPORTED
// expo router
import { useRouter } from 'expo-router';
//firebase auth
import { onAuthStateChanged } from 'firebase/auth';
import { Unsubscribe, addDoc, collection, doc, onSnapshot as onDocSnapshot, onSnapshot, query,
  serverTimestamp, setDoc, where,
} from 'firebase/firestore';
//uses react hooks. Functions that add stuff without writing classes/defs
// learned using https://www.w3schools.com/react/react_hooks.asp and adapted for my project with my own work 
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, ScrollView, TextInput, TouchableOpacity,
} from 'react-native';
import { auth, db } from '../../FirebaseConfig';
import Logo from '../../components/Logo';
import { Text, View } from '../../components/Themed';
import { styles } from '../../components/style.four'; 
// all the above are relatively pathed as they should be
//defines the league type for the file
type League = { id: string; name: string; game?: string | null };

export default function TabFourScreen() {
  const router = useRouter();

  // creatin/ defining states https://www.w3schools.com/react/react_usestate.asp
  // allows me to track the state of something in a function basically allows me to track status
  const [leagueName, setLeagueName] = useState('');
  const [game, setGame] = useState('');
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const leagueUnsubsRef = useRef<Record<string, Unsubscribe>>({});

  // Keep user in sync with changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return () => unsub();
  }, []);

  // Subscribes to user's memberships and listen for live league updates
  //https://www.w3schools.com/react/react_useeffect.asp  use effect from w3 schools allows 'side affects'
  useEffect(() => {
    const cleanupAllLeagueListeners = () => {
      Object.values(leagueUnsubsRef.current).forEach((unsub) => unsub?.());
      leagueUnsubsRef.current = {};
    };

    if (!uid) {
      cleanupAllLeagueListeners();
      setMyLeagues([]);
      setLoadingLeagues(false);
      return;
    }

    setLoadingLeagues(true);
    const qy = query(collection(db, 'leagueMembers'), where('userId', '==', uid));
// im using on snapshot here which is from firestore. Means that every change in the db it changes for the user. Realt ime lsitener. 
//If the user has no leagues it stops listneing
    const unsubscribeMemberships = onSnapshot(
      qy,
      (snap) => {
        const leagueIds = snap.docs.map((d) => d.data().leagueId as string);

        if (leagueIds.length === 0) {
          cleanupAllLeagueListeners();
          setMyLeagues([]);
          setLoadingLeagues(false);
          return;
        }

        // remove listeners for leagues user left
        Object.keys(leagueUnsubsRef.current).forEach((id) => {
          if (!leagueIds.includes(id)) {
            leagueUnsubsRef.current[id]?.();
            delete leagueUnsubsRef.current[id];
          }
        });

        // add listeners for new leagues
        leagueIds.forEach((id) => {
          if (leagueUnsubsRef.current[id]) return; // already listening

          const unsub = onDocSnapshot(doc(db, 'leagues', id), (ld) => {
            if (!ld.exists()) {
              setMyLeagues((prev) => prev.filter((L) => L.id !== id));
              return;
            }

            const data = ld.data() as any;
            const updated = { id: ld.id, name: data.name, game: data.game ?? null } as League;

            // merge or replace league in state
            setMyLeagues((prev) => {
              const i = prev.findIndex((L) => L.id === id);
              if (i === -1) return [...prev, updated];
              const copy = [...prev];
              copy[i] = updated;
              return copy;
            });

            setLoadingLeagues(false);
          });

          leagueUnsubsRef.current[id] = unsub;
        });
      },
      (err) => {
        console.error(err);
        setLoadingLeagues(false);
      }
    );

    // cleanup uid change
    return () => {
      unsubscribeMemberships();
      cleanupAllLeagueListeners();
    };
  }, [uid]);

  // Create new league. FChecks if user is logged in and adds new document to firestore leagues collection
  //Then creates a leagueMember record for the current user as the owner.
  //Shows a success message and clears the form.
  const handleCreateLeague = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Please sign in first');
    if (!leagueName.trim()) return Alert.alert('League name is required');

    try {
      // Create new league document
      const leagueRef = await addDoc(collection(db, 'leagues'), {
        name: leagueName.trim(),
        game: game.trim() || null,
        ownerId: user.uid,
        admins: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add membership record
      const membershipId = `${leagueRef.id}_${user.uid}`;
      await setDoc(doc(db, 'leagueMembers', membershipId), {
        id: membershipId,
        leagueId: leagueRef.id,
        userId: user.uid,
        role: 'admin',
        status: 'active',
        joinedAt: serverTimestamp(),
        addedBy: user.uid,
      });

      Alert.alert('Success!', 'League created successfully.');
      setLeagueName('');
      setGame('');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error?.message ?? 'Unknown error');
    }
  };
// the styling and UI FOR the league tab
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Logo size="medium" showTagline={true} />
        </View>
        
        <Text style={styles.mainTitle}>Create League</Text>
  
        {/* League Name */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="League name"
            value={leagueName}
            onChangeText={setLeagueName}
            autoCapitalize="words"
          />
        </View>
  
        {/* Game */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Game (e.g. FIFA, NBA 2K)"
            value={game}
            onChangeText={setGame}
            autoCapitalize="words"
          />
        </View>
  
        {/* Create button */}
        <TouchableOpacity style={styles.button} onPress={handleCreateLeague}>
          <Text style={styles.buttonText}>Create League</Text>
        </TouchableOpacity>
  
        <View style={{ height: 24 }} />
  
        <Text style={styles.sectionTitle}>My Leagues</Text>
  
        {loadingLeagues ? (
          <ActivityIndicator />
        ) : myLeagues.length === 0 ? (
          <Text style={styles.emptyText}>
            You haven’t created or joined any leagues yet.
          </Text>
        ) : (
          <FlatList
            style={{ width: '100%', marginTop: 8 }}
            data={myLeagues}
            keyExtractor={(item) => item.id}
            // Let the outer ScrollView handle scrolling:
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/league/[leagueId]',
                    params: { leagueId: item.id },
                  })
                }
              >
                <View style={styles.leagueItem}>
                  <Text style={styles.leagueName}>{item.name}</Text>
                  {item.game ? <Text style={styles.leagueGame}>{item.game}</Text> : null}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}