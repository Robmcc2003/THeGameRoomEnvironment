import { auth, db } from '../../FirebaseConfig';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  limit as qLimit,
} from 'firebase/firestore';

/* Batch deletion code (lines 13-26) adapted from Firestore documentation - https://firebase.google.com/docs/firestore/manage-data/delete-data */
/* I modified it to delete documents in chunks to avoid timeouts which was an issue i kept coming across*/
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

/* Delete league function (lines 29-36) uses Firestore deleteDoc - https://firebase.google.com/docs/firestore/manage-data/delete-data */
/* I cascade delete related data (invites, members) before deleting the league */
export async function deleteLeague(leagueId: string) {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');

  await deleteByQuery('leagueInvites', 'leagueId', leagueId);
  await deleteByQuery('leagueMembers', 'leagueId', leagueId);
  await deleteDoc(doc(db, 'leagues', leagueId));
}
