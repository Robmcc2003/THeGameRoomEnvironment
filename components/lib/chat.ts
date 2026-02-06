// I handle league chat: sending messages and subscribing to the messages subcollection (leagueChats/{leagueId}/messages).
// Ref: Firestore - https://firebase.google.com/docs/firestore
import { auth, db } from '../../FirebaseConfig';
import {
  collection,
  doc,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDocs,
  getDoc,
  Timestamp,
} from 'firebase/firestore';

export type ChatMessage = {
  id: string;
  leagueId: string;
  userId: string;
  displayName: string;
  username?: string | null;
  photoURL?: string | null;
  text: string;
  createdAt: Timestamp | Date;
};

// I send a message to a league chat; only signed-in users can send.
export async function sendLeagueMessage(leagueId: string, text: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  const textTrimmed = (text ?? '').trim();
  if (!textTrimmed) throw new Error('Message cannot be empty.');

  // Get user display name and info
  let displayName = current.displayName || current.email?.split('@')[0] || 'Player';
  let username: string | null = null;
  let photoURL: string | null = null;

  try {
    const userDocSnap = await getDoc(doc(db, 'users', current.uid));
    if (userDocSnap.exists()) {
      const data = userDocSnap.data() as any;
      displayName = data.displayName || displayName;
      username = data.username || null;
      photoURL = data.photoURL || null;
    }
  } catch {
    // Use defaults from auth user
  }

  // Verify user is a league member
  const memberRef = doc(db, 'leagueMembers', `${leagueId}_${current.uid}`);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists() || memberSnap.data()?.status !== 'active') {
    throw new Error('You must be a member of this league to send messages.');
  }

  // Add message
  const messagesRef = collection(db, 'leagueChats', leagueId, 'messages');
  await addDoc(messagesRef, {
    leagueId,
    userId: current.uid,
    displayName,
    username: username ?? null,
    photoURL: photoURL ?? null,
    text: textTrimmed,
    createdAt: serverTimestamp(),
  });
}

// I subscribe to real-time league chat messages and return an unsubscribe function.
export function subscribeToLeagueMessages(
  leagueId: string,
  callback: (messages: ChatMessage[]) => void,
  maxMessages: number = 100
): () => void {
  const messagesRef = collection(db, 'leagueChats', leagueId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(maxMessages));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          leagueId: data.leagueId,
          userId: data.userId,
          displayName: data.displayName || 'Player',
          username: data.username ?? null,
          photoURL: data.photoURL ?? null,
          text: data.text,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      callback(messages);
    },
    (error) => {
      console.error('[chat] Error subscribing to messages:', error);
      callback([]);
    }
  );
}

// I fetch the most recent league messages once (no real-time listener).
export async function getLeagueMessages(leagueId: string, limitCount: number = 100): Promise<ChatMessage[]> {
  const messagesRef = collection(db, 'leagueChats', leagueId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      leagueId: data.leagueId,
      userId: data.userId,
      displayName: data.displayName || 'Player',
      username: data.username ?? null,
      photoURL: data.photoURL ?? null,
      text: data.text,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
    };
  });
}
