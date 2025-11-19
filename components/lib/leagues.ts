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

// Delete documents in chunks to avoid timeouts
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

// Delete a league and all related data (invites, members, etc.)
export async function deleteLeague(leagueId: string) {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');

  await deleteByQuery('leagueInvites', 'leagueId', leagueId);
  await deleteByQuery('leagueMembers', 'leagueId', leagueId);
  await deleteDoc(doc(db, 'leagues', leagueId));
}
