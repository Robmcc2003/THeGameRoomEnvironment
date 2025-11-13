// components/lib/members.ts
import { auth, db } from '../../FirebaseConfig';
import { collection, query, where,
  getDocs, doc, getDoc, setDoc, serverTimestamp, deleteDoc,
} from 'firebase/firestore';

export type MemberRole = 'member' | 'admin';
export type MemberStatus = 'active' | 'invited' | 'pending';

type ResolvedUser = {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
};

// Resolve a user by email using /users (emailLower preferred) 
export async function resolveUserByEmail(email: string): Promise<ResolvedUser | null> {
  const emailLower = (email ?? '').trim().toLowerCase();
  if (!emailLower) return null;

  const usersCol = collection(db, 'users');

  // try emailLower
  let snap = await getDocs(query(usersCol, where('emailLower', '==', emailLower)));

  // fallback: email
  if (snap.empty) {
    snap = await getDocs(query(usersCol, where('email', '==', emailLower)));
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

// Add member by their email; create pending invite if not found
// The if statements prevent improper fillign out of the the information
//async can be used in other files
// we take the user info and return a promise, either 'added or 'invited'
//last bit not in use yet but it will combine lesgue id snd uid to create z new user in lesgue if itd not alresdy in
// use promise here so that we can run stuff outside of the block and the promise ensures action is completed later
// https://medium.com/@tejaskhartude/promise-in-react-and-react-native-377aeee065df
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

  const user = await resolveUserByEmail(emailLower);

  if (user) {
    const memberId = `${leagueId}_${user.uid}`;
    const memberRef = doc(db, 'leagueMembers', memberId);

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

  // create pending invite
  const inviteId = `${leagueId}_${emailLower}`;
  const inviteRef = doc(db, 'leagueInvites', inviteId);

  await setDoc(inviteRef, {
    id: inviteId,
    leagueId,
    emailLower,
    status: 'pending',
    createdAt: serverTimestamp(),
    invitedBy: current.uid,
  });

  return { kind: 'invited', inviteId, emailLower };
}

//List active members for a league 
export async function listMembers(leagueId: string) {
  const qs = await getDocs(query(collection(db, 'leagueMembers'), where('leagueId', '==', leagueId)));
  return qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

// Remove a member by composite id leagueId_userId 
export async function removeMember(leagueId: string, userId: string) {
  await deleteDoc(doc(db, 'leagueMembers', `${leagueId}_${userId}`));
}

// Invites helpers 

export type InviteRow = {
  id: string;
  leagueId: string;
  emailLower: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedBy?: string;
  createdAt?: any;
  resentAt?: any;
};

export async function listInvites(leagueId: string): Promise<InviteRow[]> {
  const qs = await getDocs(query(collection(db, 'leagueInvites'), where('leagueId', '==', leagueId)));
  return qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as InviteRow[];
}

export async function cancelInvite(leagueId: string, emailLower: string) {
  const id = `${leagueId}_${emailLower.toLowerCase().trim()}`;
  await deleteDoc(doc(db, 'leagueInvites', id));
}

export async function resendInvite(leagueId: string, emailLower: string) {
  const id = `${leagueId}_${emailLower.toLowerCase().trim()}`;
  await setDoc(
    doc(db, 'leagueInvites', id),
    { status: 'pending', resentAt: serverTimestamp() },
    { merge: true }
  );
}

// Member role; sets the member role e.g. user, admin, owner
export async function setMemberRole(leagueId: string, userId: string, role: MemberRole) {
    const id = `${leagueId}_${userId}`;
    await setDoc(
      doc(db, 'leagueMembers', id),
      { leagueId, role, updatedAt: serverTimestamp() }, // <-- include leagueId
      { merge: true }
    );
  }  
