// League Functions Library
// Contains functions for managing leagues (deleting leagues and related data)

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

/**
 * Delete all documents from a query in chunks to avoid timeouts.
 * This is useful when deleting many related documents.
 */
async function deleteByQuery(colPath: string, field: string, value: string, chunkSize = 200) {
  // Keep deleting in chunks until all documents are deleted
  while (true) {
    const q = query(collection(db, colPath), where(field, '==', value), qLimit(chunkSize));
    const snap = await getDocs(q);
    if (snap.empty) break; // No more documents to delete
    
    // Delete all documents in this chunk
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    // Loop again in case there are more than chunkSize documents
  }
}

/**
 * Deletes a league and all related data:
 * - leagueInvites where leagueId matches
 * - leagueMembers where leagueId matches
 * - (optional) other collections you add later (fixtures, matches, etc.)
 * Finally deletes the league document itself.
 * 
 * This ensures no orphaned data is left in the database.
 */
export async function deleteLeague(leagueId: string) {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');

  // 1) Delete related collections (top-level)
  // Delete all invites for this league
  await deleteByQuery('leagueInvites', 'leagueId', leagueId);
  // Delete all members for this league
  await deleteByQuery('leagueMembers', 'leagueId', leagueId);

  // 2) (Optional) delete more related collections if/when you add them:
  // await deleteByQuery('fixtures', 'leagueId', leagueId);
  // await deleteByQuery('matches', 'leagueId', leagueId);

  // 3) Delete the league document LAST (after all related data is deleted)
  await deleteDoc(doc(db, 'leagues', leagueId));
}
