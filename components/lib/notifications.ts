// I handle in-app notifications: Firestore collection, registration, and listening for new notifications; I use Expo Notifications for display.
import { auth, db } from '../../FirebaseConfig';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

// IMPORTANT: Firestore collection names are case-sensitive.
// I use "Notifications" (capital N) to match your created composite index.
export const NOTIFICATIONS_COLLECTION = 'Notifications' as const;

export type AppNotification = {
  id: string;
  toUserId: string;
  title: string;
  body: string;
  createdAt?: any;
  readAt?: any | null;
  sentBy?: string | null;
  leagueId?: string | null;
  type?: string | null;
  data?: Record<string, any> | null;
};

// I configure how notifications display while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function getExpoProjectId(): string | null {
  const anyConst: any = Constants;
  return (
    anyConst?.expoConfig?.extra?.eas?.projectId ??
    anyConst?.easConfig?.projectId ??
    null
  );
}

// I request notification permissions and (optionally) register an Expo push token.
// Note: in Expo Go, remote push is limited; local notifications + in-app inbox still work.
export async function registerNotificationsForCurrentUser(): Promise<{ token?: string | null }> {
  const current = auth.currentUser;
  if (!current) return { token: null };

  // Permissions (iOS/Android)
  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    finalStatus = req.status;
  }

  if (finalStatus !== 'granted') {
    return { token: null };
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return { token: null };
  }

  // Expo push token may fail in simulators/Expo Go. I treat it as optional.
  let token: string | null = null;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    token = null;
  }

  if (!token) {
    return { token: null };
  }

  // I store the token so you can add real push later (dev build / standalone).
  await updateDoc(doc(db, 'userPushTokens', current.uid), {
    userId: current.uid,
    token,
    updatedAt: serverTimestamp(),
  }).catch(async () => {
    // If the doc doesn't exist yet, I create it.
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'userPushTokens', current.uid), {
      userId: current.uid,
      token,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return { token };
}

export async function sendInAppNotificationToUser(opts: {
  toUserId: string;
  title: string;
  body: string;
  leagueId?: string | null;
  type?: string | null;
  data?: Record<string, any> | null;
}): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  const toUserId = (opts.toUserId ?? '').trim();
  if (!toUserId) throw new Error('Missing recipient.');

  const title = (opts.title ?? '').trim();
  const body = (opts.body ?? '').trim();
  if (!title || !body) throw new Error('Title and message are required.');

  const notifRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    toUserId,
    title,
    body,
    leagueId: opts.leagueId ?? null,
    type: opts.type ?? 'custom',
    data: opts.data ?? null,
    sentBy: current.uid,
    createdAt: serverTimestamp(),
    readAt: null,
  });

  // If I send to myself, I show a local notification immediately (works in Expo Go).
  if (toUserId === current.uid) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { notificationId: notifRef.id, ...(opts.data ?? {}) },
      },
      trigger: null,
    });
  }
}

export async function sendInAppNotificationToLeague(opts: {
  leagueId: string;
  title: string;
  body: string;
  type?: string | null;
  data?: Record<string, any> | null;
}): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  const leagueId = (opts.leagueId ?? '').trim();
  if (!leagueId) throw new Error('Missing league id.');

  const membersSnap = await getDocs(
    query(
      collection(db, 'leagueMembers'),
      where('leagueId', '==', leagueId),
      where('status', '==', 'active')
    )
  );

  const recipients = membersSnap.docs
    .map((d) => (d.data() as any).userId as string)
    .filter(Boolean);

  await Promise.all(
    recipients.map((toUserId) =>
      sendInAppNotificationToUser({
        toUserId,
        title: opts.title,
        body: opts.body,
        leagueId,
        type: opts.type ?? 'league_broadcast',
        data: opts.data ?? null,
      }).catch(() => undefined)
    )
  );
}

export function listenForLatestUnreadNotification(opts: {
  userId: string;
  onNotification: (n: AppNotification) => void;
}): () => void {
  const userId = (opts.userId ?? '').trim();
  if (!userId) return () => undefined;

  // I try an efficient query first (may require a composite index).
  const primaryQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('toUserId', '==', userId),
    where('readAt', '==', null),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  // Fallback: avoid composite indexes by only filtering by userId and checking unread client-side.
  const fallbackQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('toUserId', '==', userId),
    limit(25)
  );

  let ready = false;
  let unsub: (() => void) | null = null;

  const subscribe = (qy: any, isFallback: boolean): (() => void) => {
    ready = false;
    return onSnapshot(
      qy,
      (snap) => {
        if (!ready) {
          ready = true;
          return;
        }

        const change = snap.docChanges().find((c) => c.type === 'added');
        if (!change) return;

        const data = change.doc.data() as any;
        // In fallback mode I only alert for unread notifications.
        if (isFallback && data.readAt != null) return;

        opts.onNotification({
          id: change.doc.id,
          toUserId: data.toUserId,
          title: data.title,
          body: data.body,
          createdAt: data.createdAt,
          readAt: data.readAt ?? null,
          sentBy: data.sentBy ?? null,
          leagueId: data.leagueId ?? null,
          type: data.type ?? null,
          data: data.data ?? null,
        });
      },
      (error) => {
        // If Firestore says an index is required, I fall back to the simpler listener so the app keeps running.
        const msg = String((error as any)?.message ?? '');
        const code = String((error as any)?.code ?? '');
        const needsIndex =
          code === 'failed-precondition' ||
          msg.toLowerCase().includes('requires an index');

        if (!isFallback && needsIndex) {
          try {
            unsub?.();
          } catch {
          }
          unsub = subscribe(fallbackQuery, true);
        }
      }
    );
  };

  unsub = subscribe(primaryQuery, false);
  return () => unsub?.();
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const id = (notificationId ?? '').trim();
  if (!id) return;
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), {
    readAt: serverTimestamp(),
  });
}

