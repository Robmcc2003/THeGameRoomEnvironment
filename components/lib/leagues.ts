// league deletion, image upload, cascade delete of invites and members
// ref: Firestore delete - https://firebase.google.com/docs/firestore/manage-data/delete-data
import { auth, db, functions } from '../../FirebaseConfig';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit as qLimit,
} from 'firebase/firestore';

// delete in chunks to avoid Firestore limits when cascading
async function deleteByQuery(colPath: string, field: string, value: string, chunkSize = 200) {
  while (true) {
    const q = query(
      collection(db, colPath), 
      where(field, '==', value),
      qLimit(chunkSize)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) break;
    
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
}

// cascade delete invites and members then the league
export async function deleteLeague(leagueId: string) {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');

  await deleteByQuery('leagueInvites', 'leagueId', leagueId);
  await deleteByQuery('leagueMembers', 'leagueId', leagueId);
  await deleteDoc(doc(db, 'leagues', leagueId));
}

// upload league cover via Cloud Function (base64) to Firebase Storage; not Vision API
export async function uploadLeagueImage(leagueId: string, imageBase64: string): Promise<string> {
  if (!auth.currentUser) throw new Error('Not signed in');
  const callable = httpsCallable<{ leagueId: string; imageBase64: string }, { downloadUrl: string }>(functions, 'uploadLeagueImage');
  const result = await callable({ leagueId, imageBase64 });
  const data = result.data;
  if (!data?.downloadUrl) throw new Error('No download URL returned from server.');
  return data.downloadUrl;
}

// update league logoUrl in Firestore so cover shows on league page
export async function updateLeagueImageUrl(leagueId: string, logoUrl: string | null): Promise<void> {
  const leagueRef = doc(db, 'leagues', leagueId);
  await updateDoc(leagueRef, { logoUrl: logoUrl ?? null, updatedAt: serverTimestamp() });
}
