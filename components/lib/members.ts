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

// Look up a user by email address (case-insensitive)
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

// Add Member to League by Email
// This function adds a user to a league by their email address.
// It works in two ways:
// 1. If the user exists: Adds them directly as a member
// 2. If the user doesn't exist: Creates a pending invite
// This allows league owners to invite people who haven't signed up yet.
// When those people sign up later, they can see their pending invites.
// The function returns a result object that tells you what happened:
// - { kind: 'added', memberId, user }: User was added as a member
// - { kind: 'invited', inviteId, emailLower }: An invite was created
// Reference:
// - Adding data: https://firebase.google.com/docs/firestore/manage-data/add-data
// - Promises: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
// @param opts - Options object containing leagueId, email, and optional role
// @returns Promise that resolves to either 'added' or 'invited' result
// @throws Error if user not signed in, missing league ID, or empty email
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

// List All Members of a League
// This function gets all members (active, invited, pending) for a league.
// It returns an array of member objects with all their information.
// Reference: https://firebase.google.com/docs/firestore/query-data/get-data#get_multiple_documents_from_a_collection
// @param leagueId - The unique ID of the league
// @returns Array of member objects
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

// Remove a Member from a League
// This function removes a user's membership from a league.
// It deletes their membership document from the database.
// Reference: https://firebase.google.com/docs/firestore/manage-data/delete-data
// @param leagueId - The unique ID of the league
// @param userId - The unique ID of the user to remove
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

// List All Invites for a League
// This function gets all pending/accepted/declined invites for a league.
// Reference: https://firebase.google.com/docs/firestore/query-data/get-data#get_multiple_documents_from_a_collection
// @param leagueId - The unique ID of the league
// @returns Array of invite objects
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

// Cancel an Invite
// This function deletes an invite, effectively canceling it.
// Reference: https://firebase.google.com/docs/firestore/manage-data/delete-data
// @param leagueId - The unique ID of the league
// @param emailLower - The email address of the invite (lowercase)
export async function cancelInvite(leagueId: string, emailLower: string) {
  // Create the invite ID (same format as when I created it)
  const id = `${leagueId}_${emailLower.toLowerCase().trim()}`;
  // Delete the invite document
  await deleteDoc(doc(db, 'leagueInvites', id));
}

// Resend an Invite
// This function updates an invite to mark it as resent.
// It changes the status back to 'pending' and updates the resentAt timestamp.
// This is useful if someone didn't receive the original invite or wants to send a reminder.
// Reference: https://firebase.google.com/docs/firestore/manage-data/add-data#update-data
// @param leagueId - The unique ID of the league
// @param emailLower - The email address of the invite (lowercase)
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

// Set Member Role
// This function changes a member's role (member or admin).
// Only league owners/admins can call this function (enforced by security rules).
// Reference: https://firebase.google.com/docs/firestore/manage-data/add-data#update-data
// @param leagueId - The unique ID of the league
// @param userId - The unique ID of the user
// @param role - The new role ('member' or 'admin')
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
