// I handle league members and invites: resolve user by email, add members, list members/invites, resend invite, set role. I use Firestore for all operations.
// Ref: Firestore - https://firebase.google.com/docs/firestore
import { auth, db } from '../../FirebaseConfig';
import { collection, query, where,
  getDocs, doc, getDoc, setDoc, serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { autoGenerateBracketIfNeeded } from './tournaments';

export type MemberRole = 'member' | 'admin';
export type MemberStatus = 'active' | 'invited' | 'pending';

type ResolvedUser = {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
};

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
  // Get the currently signed-in user
  const current = auth.currentUser;
  if (!current) throw new Error('You must be signed in.');

  // Validate league ID
  const leagueId = (opts.leagueId ?? '').trim();
  if (!leagueId) throw new Error('Missing league id.');

  // Validate and normalize email
  const emailLower = (opts.email ?? '').trim().toLowerCase();
  if (!emailLower) throw new Error('Email is empty.');

  // Try to find the user by email
  const user = await resolveUserByEmail(emailLower);

  // If user exists, add them as a member
  if (user) {
    // Create a unique member ID: leagueId_userId
    // This ensures one membership record per user per league
    const memberId = `${leagueId}_${user.uid}`;
    const memberRef = doc(db, 'leagueMembers', memberId);

    // Check if they're already a member
    const existing = await getDoc(memberRef);
    if (existing.exists()) {
      // They're already a member, just return their info
      return { kind: 'added', memberId, user };
    }

    // Add them as a new member
    // setDoc() creates a new document
    // Firestore docs: https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document
    await setDoc(memberRef, {
      id: memberId,
      leagueId,
      userId: user.uid,
      role: opts.role ?? 'member', // Default to 'member' if no role specified
      status: 'active' as MemberStatus, // They're actively participating
      displayName: user.displayName ?? null, // Their display name
      photoURL: user.photoURL ?? null, // Their profile picture (if any)
      joinedAt: serverTimestamp(), // When they joined (server timestamp is accurate)
      addedBy: current.uid, // Who added them (the person calling this function)
    });

    // Auto-generate brackets if conditions are met
    // This makes the bracket tab always useful without manual intervention
    await autoGenerateBracketIfNeeded(leagueId);

    return { kind: 'added', memberId, user };
  }

  // If user doesn't exist, create a pending invite
  // This allows them to join later when they sign up
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

// Invite Row Type
// This defines the structure of an invite document in the database.
export type InviteRow = {
  id: string; // Invite document ID
  leagueId: string; // Which league
  emailLower: string; // Invited email (lowercase)
  status: 'pending' | 'accepted' | 'declined'; // Invite status
  invitedBy?: string; // Who sent the invite
  createdAt?: any; // When invite was created
  resentAt?: any; // When invite was last resent
};

/* List invites function (lines 184-196) uses Firestore queries - https://firebase.google.com/docs/firestore/query-data/get-data#get_multiple_documents_from_a_collection */
export async function listInvites(leagueId: string): Promise<InviteRow[]> {
  // Query all invites where leagueId matches
  const qs = await getDocs(query(
    collection(db, 'leagueInvites'), 
    where('leagueId', '==', leagueId)
  ));
  
  // Convert to InviteRow array
  return qs.docs.map((d) => ({ 
    id: d.id, 
    ...(d.data() as any) 
  })) as InviteRow[];
}

/* Cancel invite function (lines 203-208) uses Firestore deleteDoc - https://firebase.google.com/docs/firestore/manage-data/delete-data */
export async function cancelInvite(leagueId: string, emailLower: string) {
  // Create the invite ID (same format as when I created it)
  const id = `${leagueId}_${emailLower.toLowerCase().trim()}`;
  // Delete the invite document
  await deleteDoc(doc(db, 'leagueInvites', id));
}
/* Resend invite function (lines 215-229) uses Firestore setDoc with merge - https://firebase.google.com/docs/firestore/manage-data/add-data#update-data */
export async function resendInvite(leagueId: string, emailLower: string) {
  // Create the invite ID
  const id = `${leagueId}_${emailLower.toLowerCase().trim()}`;
  // Update the invite document
  // merge: true means I only update the fields I specify, keeping other fields unchanged
  // Firestore update docs: https://firebase.google.com/docs/firestore/manage-data/add-data#update-data
  await setDoc(
    doc(db, 'leagueInvites', id),
    { 
      status: 'pending', // Reset status to pending
      resentAt: serverTimestamp() // Record when it was resent
    },
    { merge: true } // Merge with existing data (don't overwrite everything)
  );
}

/* Set member role function (lines 238-251) uses Firestore setDoc with merge - https://firebase.google.com/docs/firestore/manage-data/add-data#update-data */
export async function setMemberRole(leagueId: string, userId: string, role: MemberRole) {
  // Create the member ID
  const id = `${leagueId}_${userId}`;
  // Update the member document with new role
  await setDoc(
    doc(db, 'leagueMembers', id),
    { 
      leagueId, // Include leagueId (good practice)
      role, // New role
      updatedAt: serverTimestamp() // When role was changed
    },
    { merge: true } // Merge with existing data
  );
}
