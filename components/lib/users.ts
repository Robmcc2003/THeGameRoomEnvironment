import { db } from '../../FirebaseConfig';
import {
  collection,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  where,
  doc,
} from 'firebase/firestore';
import { resolveUserByEmail } from './members';

export type PublicUserSummary = {
  id: string;
  username?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

function normaliseSearchTerm(term: string): string {
  return (term ?? '').trim().toLowerCase();
}

// I search for users by username/display name so players can find friends.
export async function searchUsers(term: string, opts?: { limit?: number; excludeUserId?: string | null }): Promise<PublicUserSummary[]> {
  const q = normaliseSearchTerm(term);
  const max = Math.min(Math.max(opts?.limit ?? 10, 1), 25);
  const exclude = opts?.excludeUserId ?? null;

  if (!q) return [];

  // If it looks like an email, I use the existing email lookup.
  if (q.includes('@')) {
    const resolved = await resolveUserByEmail(q);
    if (!resolved) return [];
    if (exclude && resolved.uid === exclude) return [];
    return [
      {
        id: resolved.uid,
        displayName: resolved.displayName ?? null,
        photoURL: resolved.photoURL ?? null,
        username: null,
      },
    ];
  }

  const usersCol = collection(db, 'users');
  const prefixEnd = `${q}\uf8ff`;

  // I run two prefix queries (username and displayName) and merge results.
  const [byUsername, byDisplayName] = await Promise.all([
    getDocs(
      query(usersCol, orderBy('usernameLower'), startAt(q), endAt(prefixEnd), limit(max))
    ).catch(() => null),
    getDocs(
      query(usersCol, orderBy('displayNameLower'), startAt(q), endAt(prefixEnd), limit(max))
    ).catch(() => null),
  ]);

  const results: PublicUserSummary[] = [];
  const seen = new Set<string>();

  const addDoc = (d: any) => {
    const id = d.id as string;
    if (!id) return;
    if (exclude && id === exclude) return;
    if (seen.has(id)) return;
    const data = d.data() as any;
    seen.add(id);
    results.push({
      id,
      username: data.username ?? null,
      displayName: data.displayName ?? null,
      photoURL: data.photoURL ?? null,
    });
  };

  byUsername?.docs?.forEach(addDoc);
  byDisplayName?.docs?.forEach(addDoc);

  // Fallback: exact match on username if prefix fields are missing
  if (results.length === 0) {
    const exact = await getDocs(query(usersCol, where('username', '==', term.trim()), limit(max))).catch(() => null);
    exact?.docs?.forEach(addDoc);
  }

  return results.slice(0, max);
}

// I fetch basic user info for a public profile screen.
export async function getPublicUserSummary(userId: string): Promise<PublicUserSummary | null> {
  const id = (userId ?? '').trim();
  if (!id) return null;
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return {
    id: snap.id,
    username: data.username ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
  };
}

