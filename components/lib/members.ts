// league members and invites: resolve by email, add, list, resend invite, set role via Firestore
// ref: Firestore - https://firebase.google.com/docs/firestore
import { auth, db } from '../../FirebaseConfig';
import { collection, query, where,
  getDocs, doc, getDoc, setDoc, serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { autoGenerateBracketIfNeeded, generateRoundRobinFixtures } from './tournaments';

export type MemberRole = 'member' | 'admin';
export type MemberStatus = 'active' | 'invited' | 'pending';

type ResolvedUser = {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  avatarId?: string | null;
  email?: string | null;
};

// look up user by email (try emailLower then email)
export async function resolveUserByEmail(email: string): Promise<ResolvedUser | null> {
  const emailLower = (email ?? '').trim().toLowerCase();
  if (!emailLower) return null;

  const usersCol = collection(db, 'users');
  let snap = await getDocs(query(usersCol, where('emailLower', '==', emailLower)));

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
    avatarId: data.avatarId ?? null,
    email: data.email ?? emailLower,
  };
}

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
      avatarId: user.avatarId ?? null,
      joinedAt: serverTimestamp(),
      addedBy: current.uid,
    });

    // auto-generate brackets/fixtures if league format and member count allow
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSnap = await getDoc(leagueRef);
    if (leagueSnap.exists()) {
      const leagueData = leagueSnap.data();
      const format = leagueData.tournamentFormat;
      if (format === 'single_elimination' || format === 'double_elimination') {
        await autoGenerateBracketIfNeeded(leagueId);
      } else if (format === 'round_robin') {
        // Check if fixtures already exist
        const matchesQuery = query(
          collection(db, 'tournamentMatches'),
          where('leagueId', '==', leagueId)
        );
        const matchesSnap = await getDocs(matchesQuery);
        if (matchesSnap.size === 0) {
          // No fixtures yet, try to generate them (needs 2+ members)
          try {
            await generateRoundRobinFixtures(leagueId);
          } catch {
            // Ignore if not enough members yet
          }
        }
      }
    }

    return { kind: 'added', memberId, user };
  }

  // user not found: create pending invite so they can join when they sign up
  const inviteId = `${leagueId}_${emailLower}`;
  const inviteRef = doc(db, 'leagueInvites', inviteId);

  // Create the invite document
  await setDoc(inviteRef, {
    id: inviteId,
    leagueId,
    emailLower, // Store lowercase email for consistent lookups
    status: 'pending', // Invite is waiting to be accepted
    createdAt: serverTimestamp(), // When invite was created
    invitedBy: current.uid, // Who sent the invite
  });

  return { kind: 'invited', inviteId, emailLower };
}

/* List members function (lines 140-153) uses Firestore queries - https://firebase.google.com/docs/firestore/query-data/get-data#get_multiple_documents_from_a_collection */
export async function listMembers(leagueId: string) {
  // Query all members where leagueId matches
  const qs = await getDocs(query(
    collection(db, 'leagueMembers'), 
    where('leagueId', '==', leagueId)
  ));
  
  // Convert Firestore documents to plain objects
  // Array.map() docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
  return qs.docs.map((d) => ({ 
    id: d.id, // Document ID
    ...(d.data() as any) // All other fields (userId, role, status, etc.)
  }));
}

/* Remove member function (lines 160-165) uses Firestore deleteDoc - https://firebase.google.com/docs/firestore/manage-data/delete-data */
export async function removeMember(leagueId: string, userId: string) {
  // Create the member ID (same format as when I added them)
  const memberId = `${leagueId}_${userId}`;
  // Delete the membership document
  await deleteDoc(doc(db, 'leagueMembers', memberId));
}

// invite row shape for listInvites
export type InviteRow = {
  id: string; // Invite document ID
  leagueId: string; // Which league
  emailLower: string; // Invited email (lowercase)
  status: 'pending' | 'accepted' | 'declined'; // Invite status
  invitedBy?: string; // Who sent the invite
  createdAt?: any; // When invite was created
  resentAt?: any; // When invite was last resent
};

// ref: Firestore get multiple docs - https://firebase.google.com/docs/firestore/query-data/get-data#get_multiple_documents_from_a_collection
export async function listInvites(leagueId: string): Promise<InviteRow[]> {
  const qs = await getDocs(query(
    collection(db, 'leagueInvites'),
    where('leagueId', '==', leagueId)
  ));
  return qs.docs.map((d) => ({ 
    id: d.id, 
    ...(d.data() as any) 
  })) as InviteRow[];
}

// ref: Firestore delete - https://firebase.google.com/docs/firestore/manage-data/delete-data
export async function cancelInvite(leagueId: string, emailLower: string) {
  const id = `${leagueId}_${emailLower.toLowerCase().trim()}`;
  await deleteDoc(doc(db, 'leagueInvites', id));
}

// ref: Firestore setDoc merge - https://firebase.google.com/docs/firestore/manage-data/add-data#update-data
export async function resendInvite(leagueId: string, emailLower: string) {
  const id = `${leagueId}_${emailLower.toLowerCase().trim()}`;
  await setDoc(
    doc(db, 'leagueInvites', id),
    { status: 'pending', resentAt: serverTimestamp() },
    { merge: true }
  );
}

// ref: Firestore setDoc merge - https://firebase.google.com/docs/firestore/manage-data/add-data#update-data
export async function setMemberRole(leagueId: string, userId: string, role: MemberRole) {
  const id = `${leagueId}_${userId}`;
  await setDoc(
    doc(db, 'leagueMembers', id),
    { leagueId, role, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
