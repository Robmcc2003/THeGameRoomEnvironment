
import { auth, db } from '../../FirebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';

export type MemberRole = 'member' | 'admin';
export type MemberStatus = 'active' | 'invited' | 'pending';

type ResolvedUser = {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
};

/**
 * Resolve a user by email address using the Firestore /users collection.
 * Prefers 'emailLower' (recommended) but falls back to 'email'.
 */
export async function resolveUserByEmail(email: string): Promise<ResolvedUser | null> {
  const emailLower = (email ?? '').trim().toLowerCase();
  if (!emailLower) return null;

  const usersCol = collection(db, 'users');

  // Try emailLower first (recommended profile field)
  const qLower = query(usersCol, where('emailLower', '==', emailLower));
  let snap = await getDocs(qLower);

  // Fallback: try 'email' if no emailLower match
  if (snap.empty) {
    const qEmail = query(usersCol, where('email', '==', emailLower));
    snap = await getDocs(qEmail);
  }

  if (snap.empty) return null;

  const d = snap.docs[0];
  const data = d.data() as any;

  return {
    uid: d.id,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    email: data.email ?? emailLower,
  };
}

/**
 * Add a user (by email) to a league. If the /users profile is not found,
 * create a pending invite in /leagueInvites and return { kind: 'invited' }.
 */
export async function addMemberToLeague(opts: {
  leagueId: string;
  email: string;
  role?: MemberRole;
}): Promise<
  | { kind: 'added'; memberId: string; user: ResolvedUser }
  | { kind: 'invited'; inviteId: string; emailLower: string }
> {
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  const leagueId = (opts.leagueId ?? '').trim();
  if (!leagueId) throw new Error('Missing league id.');

  const emailLower = (opts.email ?? '').trim().toLowerCase();
  if (!emailLower) throw new Error('Email is empty.');

  // 1) Try resolve existing user profile
  const user = await resolveUserByEmail(emailLower);

  if (user) {
    // Use deterministic member id to avoid duplicates
    const memberId = `${leagueId}_${user.uid}`;
    const memberRef = doc(db, 'leagueMembers', memberId);

    // If already a member, no-op
    const existing = await getDoc(memberRef);
    if (existing.exists()) {
      return { kind: 'added', memberId, user };
    }

    await setDoc(memberRef, {
      id: memberId,
      leagueId,
      userId: user.uid,
      role: opts.role ?? 'member',
      status: 'active' as MemberStatus,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      joinedAt: serverTimestamp(),
      addedBy: current.uid,
    });

    return { kind: 'added', memberId, user };
  }

  // 2) No /users profile yet → create a pending invite
  const inviteId = `${leagueId}_${emailLower}`;
  const inviteRef = doc(db, 'leagueInvites', inviteId);

  await setDoc(inviteRef, {
    id: inviteId,
    leagueId,
    emailLower,
    status: 'pending', // later you can flip to 'accepted' when they sign up
    createdAt: serverTimestamp(),
    invitedBy: current.uid,
  });

  // can create a row with possible invites
  // For now im keeping invites separate.

  return { kind: 'invited', inviteId, emailLower };
}

/**
 * List active members for a league from /leagueMembers.
 * (Invites are separate; add a listInvites() if you want to render them too.)
 */
export async function listMembers(leagueId: string) {
  const qMembers = query(collection(db, 'leagueMembers'), where('leagueId', '==', leagueId));
  const snap = await getDocs(qMembers);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** Remove a member by composite id convention leagueId_userId */
export async function removeMember(leagueId: string, userId: string) {
  const ref = doc(db, 'leagueMembers', `${leagueId}_${userId}`);
  await deleteDoc(ref);
}

// Add this type near your other types
export type InviteRow = {
    id: string;
    leagueId: string;
    emailLower: string;
    status: 'pending' | 'accepted' | 'declined';
    invitedBy?: string;
    createdAt?: any;
  };
  
  // New: list invites for a league
  export async function listInvites(leagueId: string): Promise<InviteRow[]> {
    const qInv = query(collection(db, 'leagueInvites'), where('leagueId', '==', leagueId));
    const snap = await getDocs(qInv);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as InviteRow[];
  }
  
