// league chat: send and subscribe to messages via Firestore leagueChats/{leagueId}/messages
// ref: Firestore - https://firebase.google.com/docs/firestore
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
  avatarId?: string | null;
  text: string;
  createdAt: Timestamp | Date;
};

// send message to league chat; signed-in members only
export async function sendLeagueMessage(leagueId: string, text: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  const textTrimmed = (text ?? '').trim();
  if (!textTrimmed) throw new Error('Message cannot be empty.');

  let displayName = current.displayName || current.email?.split('@')[0] || 'Player';
  let username: string | null = null;
  let photoURL: string | null = null;
  let avatarId: string | null = null;

  try {
    const userDocSnap = await getDoc(doc(db, 'users', current.uid));
    if (userDocSnap.exists()) {
      const data = userDocSnap.data() as any;
      displayName = data.displayName || displayName;
      username = data.username || null;
      photoURL = data.photoURL || null;
      avatarId = data.avatarId ?? null;
    }
  } catch {
    // keep defaults from auth
  }

  const memberRef = doc(db, 'leagueMembers', `${leagueId}_${current.uid}`);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists() || memberSnap.data()?.status !== 'active') {
    throw new Error('You must be a member of this league to send messages.');
  }

  const messagesRef = collection(db, 'leagueChats', leagueId, 'messages');
  await addDoc(messagesRef, {
    leagueId,
    userId: current.uid,
    displayName,
    username: username ?? null,
    photoURL: photoURL ?? null,
    avatarId: avatarId ?? null,
    text: textTrimmed,
    createdAt: serverTimestamp(),
  });
}

// subscribe to real-time messages, return unsubscribe function
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
          avatarId: data.avatarId ?? null,
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
