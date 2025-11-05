import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, Alert, View, FlatList, ActivityIndicator,
} from 'react-native';
import { auth, db } from '../../FirebaseConfig'; // keep your existing path
import { addDoc, collection, serverTimestamp, doc, setDoc, onSnapshot, query, where, getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

type League = { id: string; name: string; game?: string | null };

export default function TabFourScreen() {
  const [leagueName, setLeagueName] = useState('');
  const [game, setGame] = useState('');
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);

  // Keep uid in sync with auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // Subscribe to my memberships and load league docs
  useEffect(() => {
    if (!uid) {
      setMyLeagues([]);
      setLoadingLeagues(false);
      return;
    }

    setLoadingLeagues(true);
    const q = query(collection(db, 'leagueMembers'), where('uid', '==', uid));
    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        try {
          const leagueIds = snap.docs.map((d) => d.data().leagueId as string);
          if (leagueIds.length === 0) {
            setMyLeagues([]);
            setLoadingLeagues(false);
            return;
          }

          const leagues = await Promise.all(
            leagueIds.map(async (id) => {
              const ref = doc(db, 'leagues', id);
              const ld = await getDoc(ref);
              if (!ld.exists()) return null;
              const data = ld.data() as any;
              return { id: ld.id, name: data.name, game: data.game ?? null } as League;
            })
          );

          setMyLeagues(leagues.filter(Boolean) as League[]);
          setLoadingLeagues(false);
        } catch (e) {
          console.error(e);
          setLoadingLeagues(false);
        }
      },
      (err) => {
        console.error(err);
        setLoadingLeagues(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const handleCreateLeague = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Please sign in first');
      return;
    }
    if (!leagueName.trim()) {
      Alert.alert('League name is required');
      return;
    }

    try {
      // 1) Create league
      const leagueRef = await addDoc(collection(db, 'leagues'), {
        name: leagueName.trim(),
        game: game.trim() || null,
        ownerId: user.uid,
        admins: [user.uid], // optional for future admin logic
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2) Add creator as owner in leagueMembers
      const membershipId = `${leagueRef.id}_${user.uid}`;
      await setDoc(doc(db, 'leagueMembers', membershipId), {
        leagueId: leagueRef.id,
        uid: user.uid,
        role: 'owner',
        joinedAt: serverTimestamp(),
      });

      Alert.alert('Success!', 'League created and you are the owner.');
      setLeagueName('');
      setGame('');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error?.message ?? 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.mainTitle}>Create League</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="League name"
          value={leagueName}
          onChangeText={setLeagueName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Game (e.g. FIFA, NBA 2K)"
          value={game}
          onChangeText={setGame}
          autoCapitalize="words"
        />
      </View>

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
          renderItem={({ item }) => (
            <View style={styles.leagueItem}>
              <Text style={styles.leagueName}>{item.name}</Text>
              {item.game ? <Text style={styles.leagueGame}>{item.game}</Text> : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  input: {
    height: 45,
    borderColor: 'gray',
    borderWidth: 1,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#5C6BC0',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    shadowColor: '#5C6BC0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    width: '100%',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    color: '#333',
  },
  emptyText: {
    width: '100%',
    marginTop: 6,
    color: '#666',
  },
  leagueItem: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  leagueGame: {
    marginTop: 2,
    fontSize: 14,
    color: '#555',
  },
});
