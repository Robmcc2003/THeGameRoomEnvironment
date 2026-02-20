// achievement badges: define, award from matches/tournaments, read/write in Firestore
// ref: Badge UI - https://chatgpt.com/share/69862ad5-9300-8007-9d95-100d9c6fc6b9
import { auth, db } from '../../FirebaseConfig';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getUserOverallStats } from './tournaments';

export type BadgeCategory = 'tournament' | 'shooter' | 'general';
export type BadgeRarity = 'bronze' | 'silver' | 'gold';

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  // Icon name from @expo/vector-icons/FontAwesome
  icon: string;
};

export type EarnedBadge = {
  badgeId: string;
  earnedAt: any;
  source?: {
    type: 'match' | 'tournament' | 'system';
    leagueId?: string;
    matchId?: string;
  };
};

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'first_win',
    title: 'First W',
    description: 'Win your first verified match.',
    category: 'general',
    rarity: 'bronze',
    icon: 'trophy',
  },
  {
    id: 'five_verified_matches',
    title: 'Warming Up',
    description: 'Complete 5 verified matches.',
    category: 'general',
    rarity: 'bronze',
    icon: 'fire',
  },
  {
    id: 'ten_verified_matches',
    title: 'On The Grind',
    description: 'Complete 10 verified matches.',
    category: 'general',
    rarity: 'silver',
    icon: 'bolt',
  },
  {
    id: 'twenty_five_verified_matches',
    title: 'Battle Tested',
    description: 'Complete 25 verified matches.',
    category: 'general',
    rarity: 'gold',
    icon: 'shield',
  },
  {
    id: 'first_tournament_win',
    title: 'Champion',
    description: 'Win your first tournament (verified final).',
    category: 'tournament',
    rarity: 'bronze',
    icon: 'trophy',
  },
  {
    id: 'tournament_wins_3',
    title: 'Serial Winner',
    description: 'Win 3 tournaments (verified finals).',
    category: 'tournament',
    rarity: 'silver',
    icon: 'trophy',
  },
  {
    id: 'tournament_wins_5',
    title: 'Hall of Fame',
    description: 'Win 5 tournaments (verified finals).',
    category: 'tournament',
    rarity: 'gold',
    icon: 'trophy',
  },
  {
    id: 'tournament_veteran_5',
    title: 'Tournament Vet',
    description: 'Join 5 tournaments.',
    category: 'tournament',
    rarity: 'bronze',
    icon: 'users',
  },
  {
    id: 'tournament_veteran_10',
    title: 'Seasoned',
    description: 'Join 10 tournaments.',
    category: 'tournament',
    rarity: 'silver',
    icon: 'users',
  },
  {
    id: 'tournament_veteran_20',
    title: 'All In',
    description: 'Join 20 tournaments.',
    category: 'tournament',
    rarity: 'gold',
    icon: 'users',
  },
  {
    id: 'cod_10_bomb',
    title: '10 Bomb',
    description: 'Drop 10+ kills in a verified Call of Duty match.',
    category: 'shooter',
    rarity: 'bronze',
    icon: 'crosshairs',
  },
  {
    id: 'cod_20_bomb',
    title: '20 Bomb',
    description: 'Drop 20+ kills in a verified Call of Duty match.',
    category: 'shooter',
    rarity: 'silver',
    icon: 'crosshairs',
  },
  {
    id: 'cod_30_bomb',
    title: '30 Bomb',
    description: 'Drop 30+ kills in a verified Call of Duty match.',
    category: 'shooter',
    rarity: 'gold',
    icon: 'crosshairs',
  },
  {
    id: 'cod_kd_1_5',
    title: 'Sharp Shooter',
    description: 'Reach a 1.5+ K/D (verified COD stats).',
    category: 'shooter',
    rarity: 'bronze',
    icon: 'bullseye',
  },
  {
    id: 'cod_kd_2_0',
    title: 'Clean K/D',
    description: 'Reach a 2.0+ K/D (verified COD stats).',
    category: 'shooter',
    rarity: 'silver',
    icon: 'bullseye',
  },
  {
    id: 'cod_kd_3_0',
    title: 'Unstoppable',
    description: 'Reach a 3.0+ K/D (verified COD stats).',
    category: 'shooter',
    rarity: 'gold',
    icon: 'bullseye',
  },
] as const;

export async function getUserEarnedBadges(userId: string): Promise<Record<string, EarnedBadge>> {
  const snap = await getDocs(collection(db, 'users', userId, 'badges'));
  const map: Record<string, EarnedBadge> = {};
  snap.docs.forEach(d => {
    const data = d.data() as any;
    const id = String(data?.badgeId ?? d.id);
    map[id] = {
      badgeId: id,
      earnedAt: data?.earnedAt,
      source: data?.source,
    };
  });
  return map;
}

async function getLeagueMeta(leagueId: string): Promise<{ gameType?: string | null; tournamentFormat?: string | null } | null> {
  const snap = await getDoc(doc(db, 'leagues', leagueId));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return { gameType: data.gameType ?? null, tournamentFormat: data.tournamentFormat ?? null };
}

export async function ensureBadgesUpToDateForUser(userId: string): Promise<Record<string, EarnedBadge>> {
  // I only award badges for the currently signed-in user.
  const current = auth.currentUser;
  if (!current || current.uid !== userId) {
    return await getUserEarnedBadges(userId);
  }

  const earned = await getUserEarnedBadges(userId);

  // I use the same stats as the profile (getUserOverallStats) so badges match bracket/standings.
  const stats = await getUserOverallStats(userId);
  const tournamentsWon = stats.tournamentsWon;
  const totalVerifiedMatches = stats.totalMatches; // wins + losses, verified only
  const totalWins = stats.totalWins;

  const membersSnap = await getDocs(
    query(collection(db, 'leagueMembers'), where('userId', '==', userId), where('status', '==', 'active'))
  );
  const leagueIds = Array.from(new Set(membersSnap.docs.map(d => (d.data() as any).leagueId).filter(Boolean)));

  // Fetch user's matches for COD badge stats only (kills, deaths per match).
  const [p1Snap, p2Snap] = await Promise.all([
    getDocs(query(collection(db, 'tournamentMatches'), where('player1Id', '==', userId))),
    getDocs(query(collection(db, 'tournamentMatches'), where('player2Id', '==', userId))),
  ]);
  const allMatches = [...p1Snap.docs, ...p2Snap.docs]
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter((m, idx, arr) => arr.findIndex(x => x.id === m.id) === idx);

  const verifiedMatches = allMatches.filter(m => m.status === 'completed' && m.result?.winnerId && (m.result?.verified === true || m.result?.verified === 'true'));

  const leaguesMeta: Record<string, { gameType?: string | null; tournamentFormat?: string | null }> = {};
  const getMetaCached = async (leagueId: string) => {
    if (leaguesMeta[leagueId]) return leaguesMeta[leagueId];
    const meta = await getLeagueMeta(leagueId);
    leaguesMeta[leagueId] = meta ?? {};
    return leaguesMeta[leagueId];
  };

  // COD badge signals (verified matches only)
  const codLeagueIds = new Set<string>();
  for (const m of verifiedMatches) {
    if (!m.leagueId) continue;
    const meta = await getMetaCached(m.leagueId);
    if ((meta.gameType || '').toUpperCase() === 'CALL_OF_DUTY') codLeagueIds.add(m.leagueId);
  }

  let codMaxKillsInMatch = 0;
  let codTotalKills = 0;
  let codTotalDeaths = 0;

  for (const m of verifiedMatches) {
    if (!m.leagueId || !codLeagueIds.has(m.leagueId)) continue;
    const isP1 = m.player1Id === userId;
    const scores = isP1 ? m.result?.player1Scores : m.result?.player2Scores;
    const kills = typeof scores?.kills === 'number' ? scores.kills : 0;
    const deaths = typeof scores?.deaths === 'number' ? scores.deaths : 0;
    codTotalKills += kills;
    codTotalDeaths += deaths;
    codMaxKillsInMatch = Math.max(codMaxKillsInMatch, kills);
  }

  const codKD = codTotalDeaths > 0 ? codTotalKills / codTotalDeaths : codTotalKills > 0 ? codTotalKills : 0;

  // Decide what to award
  const toAward: Array<{ badgeId: string; source?: EarnedBadge['source'] }> = [];

  if (!earned.first_win && totalWins >= 1) {
    toAward.push({ badgeId: 'first_win', source: { type: 'match' } });
  }

  if (!earned.five_verified_matches && totalVerifiedMatches >= 5) {
    toAward.push({ badgeId: 'five_verified_matches', source: { type: 'system' } });
  }

  if (!earned.ten_verified_matches && totalVerifiedMatches >= 10) {
    toAward.push({ badgeId: 'ten_verified_matches', source: { type: 'system' } });
  }

  if (!earned.twenty_five_verified_matches && totalVerifiedMatches >= 25) {
    toAward.push({ badgeId: 'twenty_five_verified_matches', source: { type: 'system' } });
  }

  if (!earned.first_tournament_win && tournamentsWon >= 1) {
    toAward.push({ badgeId: 'first_tournament_win', source: { type: 'tournament' } });
  }

  if (!earned.tournament_wins_3 && tournamentsWon >= 3) {
    toAward.push({ badgeId: 'tournament_wins_3', source: { type: 'tournament' } });
  }

  if (!earned.tournament_wins_5 && tournamentsWon >= 5) {
    toAward.push({ badgeId: 'tournament_wins_5', source: { type: 'tournament' } });
  }

  if (!earned.tournament_veteran_5 && leagueIds.length >= 5) {
    toAward.push({ badgeId: 'tournament_veteran_5', source: { type: 'system' } });
  }

  if (!earned.tournament_veteran_10 && leagueIds.length >= 10) {
    toAward.push({ badgeId: 'tournament_veteran_10', source: { type: 'system' } });
  }

  if (!earned.tournament_veteran_20 && leagueIds.length >= 20) {
    toAward.push({ badgeId: 'tournament_veteran_20', source: { type: 'system' } });
  }

  if (!earned.cod_10_bomb && codMaxKillsInMatch >= 10) {
    toAward.push({ badgeId: 'cod_10_bomb', source: { type: 'match' } });
  }

  if (!earned.cod_20_bomb && codMaxKillsInMatch >= 20) {
    toAward.push({ badgeId: 'cod_20_bomb', source: { type: 'match' } });
  }

  if (!earned.cod_30_bomb && codMaxKillsInMatch >= 30) {
    toAward.push({ badgeId: 'cod_30_bomb', source: { type: 'match' } });
  }

  if (!earned.cod_kd_1_5 && codKD >= 1.5) {
    toAward.push({ badgeId: 'cod_kd_1_5', source: { type: 'system' } });
  }

  if (!earned.cod_kd_2_0 && codKD >= 2) {
    toAward.push({ badgeId: 'cod_kd_2_0', source: { type: 'system' } });
  }

  if (!earned.cod_kd_3_0 && codKD >= 3) {
    toAward.push({ badgeId: 'cod_kd_3_0', source: { type: 'system' } });
  }

  if (toAward.length === 0) return earned;

  const now = serverTimestamp();
  const buildPayload = (item: { badgeId: string; source?: EarnedBadge['source'] }) => {
    const source = item.source ?? { type: 'system' as const };
    const cleanSource: Record<string, unknown> = { type: source.type };
    if (source.leagueId != null) cleanSource.leagueId = source.leagueId;
    if (source.matchId != null) cleanSource.matchId = source.matchId;
    return { badgeId: item.badgeId, earnedAt: now, source: cleanSource };
  };

  let batchError: Error | null = null;
  try {
    const batch = writeBatch(db);
    for (const item of toAward) {
      const ref = doc(db, 'users', userId, 'badges', item.badgeId);
      batch.set(ref, buildPayload(item), { merge: true });
    }
    await batch.commit();
  } catch (err) {
    batchError = err instanceof Error ? err : new Error(String(err));
    if (__DEV__) {
      console.error('[badges] batch commit failed:', (err as any)?.code ?? (err as any)?.message ?? err);
    }
    for (const item of toAward) {
      try {
        const ref = doc(db, 'users', userId, 'badges', item.badgeId);
        await setDoc(ref, { ...buildPayload(item), earnedAt: serverTimestamp() }, { merge: true });
      } catch (singleErr) {
        if (__DEV__) {
          console.error('[badges] setDoc failed for', item.badgeId, (singleErr as any)?.code ?? (singleErr as any)?.message ?? singleErr);
        }
      }
    }
  }

  const updated = await getUserEarnedBadges(userId);
  if (batchError && __DEV__) {
    console.warn('[badges] Award completed after batch fallback. First error:', batchError.message);
  }
  return updated;
}

