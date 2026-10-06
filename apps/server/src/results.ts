import { and, eq, sql } from 'drizzle-orm';
import { loadProfile, reward, trophyDelta } from '@fitil/content';
import type { Profile, Rewards } from '@fitil/content';
import type { MatchResult, SeatResult } from '@fitil/net';
import { today } from './accounts.ts';
import type { Db } from './db/index.ts';
import { matchPlayers, matches, profiles, trophies } from './db/schema.ts';

/** Ce primește un jucător la finalul unui meci online (trimis de server; clientul doar îl afișează). */
export interface MatchOutcome {
  place: number;
  won: boolean;
  ch: string | null;
  trophyDelta: number;
  trophies: number;
  coins: number;
  xp: number;
  firstToday: boolean;
  daily: number;
  levelUps: Rewards['levelUps'];
  playerUps: Rewards['playerUps'];
  /** Profilul nou (sursa de adevăr). */
  profile: Profile;
}

/**
 * Scrie rezultatul unui meci: o singură tranzacție pentru toți oamenii cu cont. Oamenii care au plecat
 * înainte de final primesc trofeele (pierdere) dar nu și recompensele. Doar serverul apelează asta.
 */
export async function recordMatch(
  db: Db,
  result: MatchResult,
  accounts: Map<string, string>,
  day = today(),
): Promise<Map<string, MatchOutcome>> {
  const out = new Map<string, MatchOutcome>();
  const seats = result.players.filter((p) => accounts.has(p.sid));
  if (!seats.length) return out;
  await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(matches)
      .values({ mode: result.mode, seed: result.seed | 0, ticks: result.ticks })
      .returning({ id: matches.id });
    // ordine fixă după id: două meciuri care se termină odată nu se blochează reciproc
    const sorted = [...seats].sort((a, b) => accounts.get(a.sid)!.localeCompare(accounts.get(b.sid)!));
    for (const seat of sorted) {
      const id = accounts.get(seat.sid)!;
      out.set(seat.sid, await applySeat(tx as unknown as Db, m!.id, id, seat, result, day));
    }
  });
  return out;
}

async function applySeat(
  tx: Db,
  matchId: string,
  accountId: string,
  seat: SeatResult,
  result: MatchResult,
  day: string,
): Promise<MatchOutcome> {
  const [row] = await tx
    .select({ data: profiles.data })
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .for('update');
  const cur = loadProfile(row?.data);
  // trofeele merg pe personajul jucat, nu pe cel ales acum în profil
  const ch = seat.ch ?? cur.ch;
  const [t] = await tx
    .select({ n: trophies.trophies })
    .from(trophies)
    .where(and(eq(trophies.accountId, accountId), eq(trophies.ch, ch)));
  const before = t?.n ?? 0;
  const delta = trophyDelta(result.mode, seat, before);
  const total = before + delta;
  await tx
    .insert(trophies)
    .values({ accountId, ch, trophies: total })
    .onConflictDoUpdate({ target: [trophies.accountId, trophies.ch], set: { trophies: total } });
  let profile = cur;
  let coins = 0;
  let xp = 0;
  let r: Rewards | null = null;
  if (!seat.left) {
    // recompensele se calculează pe personajul jucat
    const played = cur.ch === ch ? cur : { ...cur, ch };
    r = reward(
      played,
      { boxes: seat.boxes, kills: seat.kills, won: seat.won, team: seat.team, caps: 0, stars: 0 },
      day,
    );
    profile = { ...r.profile, ch: cur.ch };
    coins = r.coins;
    xp = r.xp;
    await tx
      .update(profiles)
      .set({ data: profile, updatedAt: sql`now()` })
      .where(eq(profiles.accountId, accountId));
  }
  await tx.insert(matchPlayers).values({
    matchId,
    accountId,
    ch,
    place: seat.place,
    won: seat.won,
    kills: seat.kills,
    boxes: seat.boxes,
    trophyDelta: delta,
    coins,
    xp,
  });
  return {
    place: seat.place,
    won: seat.won,
    ch,
    trophyDelta: delta,
    trophies: total,
    coins,
    xp,
    firstToday: r?.firstToday ?? false,
    daily: r?.daily ?? 0,
    levelUps: r?.levelUps ?? [],
    playerUps: r?.playerUps ?? [],
    profile,
  };
}
