import { createHash, randomBytes } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  accessOf,
  buyChar,
  buyTheme,
  reward,
  buyItem,
  defaultProfile,
  equip,
  loadProfile,
  playerLevel,
  selectChar,
  totalXp,
} from '@fitil/content';
import type { MatchSummary, Profile, Refusal, Rewards, ShopCat } from '@fitil/content';
import type { Db } from './db/index.ts';
import { accounts, offlineClaims, profiles, trophies } from './db/schema.ts';

export const hashToken = (t: string): string => createHash('sha256').update(t).digest('hex');

/** Ziua curentă (AAAA-LL-ZZ, UTC): bonusul zilnic și provocarea zilei se măsoară pe ceasul serverului. */
export const today = (d = new Date()): string => d.toISOString().slice(0, 10);

/** Limita monedelor la importul profilului local (profilul offline nu se poate verifica). */
export const IMPORT_MAX_COINS = 20_000;

/** Creează un cont anonim: întoarce tokenul (se arată o singură dată) și profilul nou. */
export async function createAccount(db: Db): Promise<{ id: string; token: string; profile: Profile }> {
  const token = randomBytes(32).toString('hex');
  const profile = defaultProfile();
  const id = await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(accounts)
      .values({ tokenHash: hashToken(token) })
      .returning({ id: accounts.id });
    await tx.insert(profiles).values({ accountId: a!.id, data: profile });
    return a!.id;
  });
  return { id, token, profile };
}

/** Contul după token (sau null). */
export async function authenticate(db: Db, token: string | undefined): Promise<string | null> {
  if (!token || token.length < 32 || token.length > 200) return null;
  const [a] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.tokenHash, hashToken(token)));
  return a?.id ?? null;
}

export async function getProfile(db: Db, id: string): Promise<Profile> {
  const [p] = await db.select({ data: profiles.data }).from(profiles).where(eq(profiles.accountId, id));
  return loadProfile(p?.data);
}

export async function getTrophies(db: Db, id: string): Promise<Record<string, number>> {
  const rows = await db.select().from(trophies).where(eq(trophies.accountId, id));
  return Object.fromEntries(rows.map((r) => [r.ch, r.trophies]));
}

/** Aplică `fn` pe profil sub lock (fără cursă între cereri); `null` din `fn` = refuz, nimic nu se schimbă. */
export async function updateProfile<T>(
  db: Db,
  id: string,
  fn: (p: Profile, imported: boolean) => { profile: Profile; imported?: boolean; out: T } | null,
): Promise<T | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ data: profiles.data, imported: profiles.imported })
      .from(profiles)
      .where(eq(profiles.accountId, id))
      .for('update');
    if (!row) return null;
    const r = fn(loadProfile(row.data), row.imported);
    if (!r) return null;
    await tx
      .update(profiles)
      .set({ data: r.profile, imported: r.imported ?? row.imported, updatedAt: sql`now()` })
      .where(eq(profiles.accountId, id));
    return r.out;
  });
}

export type Outcome = { ok: true; profile: Profile } | { ok: false; why: Refusal | 'imported' };

async function apply(
  db: Db,
  id: string,
  fn: (p: Profile) => { ok: true; profile: Profile } | { ok: false; why: Refusal },
): Promise<Outcome> {
  let why: Refusal = 'unknown';
  const r = await updateProfile(db, id, (p) => {
    const x = fn(p);
    if (!x.ok) {
      why = x.why;
      return null;
    }
    return { profile: x.profile, out: x.profile };
  });
  return r ? { ok: true, profile: r } : { ok: false, why };
}

const access = (p: Profile) => accessOf(p, today(), false);

export const buyItemFor = (db: Db, id: string, item: string) => apply(db, id, (p) => buyItem(p, item));
export const equipFor = (db: Db, id: string, cat: ShopCat, item: string | null) =>
  apply(db, id, (p) => equip(p, cat, item));
export const buyCharFor = (db: Db, id: string, ch: string) => apply(db, id, (p) => buyChar(p, ch, access(p)));
export const buyThemeFor = (db: Db, id: string, theme: string) =>
  apply(db, id, (p) => buyTheme(p, theme, access(p)));
export const selectCharFor = (db: Db, id: string, ch: string) =>
  apply(db, id, (p) => selectChar(p, ch, access(p)));

/**
 * Preia profilul local (offline) la prima conectare. Se acceptă o singură dată, cu monedele plafonate;
 * serverul rămâne sursa de adevăr după aceea.
 */
export async function importProfile(db: Db, id: string, raw: unknown): Promise<Outcome> {
  const local = loadProfile(raw);
  const r = await updateProfile(db, id, (cur, imported) => {
    if (imported) return null;
    const p = { ...local, coins: Math.min(local.coins, IMPORT_MAX_COINS) };
    // un cont care a jucat deja online nu mai preia: ar suprascrie recompensele
    if (totalXp(cur) > 0) return null;
    return { profile: p, imported: true, out: p };
  });
  return r ? { ok: true, profile: r } : { ok: false, why: 'imported' };
}

export async function setName(db: Db, id: string, name: string): Promise<void> {
  await db.update(accounts).set({ name }).where(eq(accounts.id, id));
}

export async function accountNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(inArray(accounts.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export const levelOfProfile = (p: Profile): number => playerLevel(totalXp(p)).level;

/** Cât poate cere un cont într-o zi pentru meciuri offline (cu boți): recompensele lor nu se pot verifica. */
export const OFFLINE_CLAIMS_PER_DAY = 30;

/** Plafoanele unui meci offline: ce depășește e tăiat (un meci cu boți nu are mai mult). */
export function clampSummary(raw: unknown): MatchSummary {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return {
    boxes: n(r.boxes, 80),
    kills: n(r.kills, 3),
    won: r.won === true,
    team: r.team === true,
    caps: n(r.caps, 5),
    stars: n(r.stars, 3),
  };
}

export type OfflineResult = { ok: true; rewards: Rewards } | { ok: false; why: 'limit' };

/** Recompensa unui meci offline (cu boți), cu plafon zilnic. Meciurile online le scrie camera, nu apelul ăsta. */
export async function claimOffline(db: Db, id: string, raw: unknown, day = today()): Promise<OfflineResult> {
  const summary = clampSummary(raw);
  return db
    .transaction(async (tx) => {
      const [c] = await tx
        .insert(offlineClaims)
        .values({ day, accountId: id, n: 1 })
        .onConflictDoUpdate({
          target: [offlineClaims.day, offlineClaims.accountId],
          set: { n: sql`${offlineClaims.n} + 1` },
        })
        .returning({ n: offlineClaims.n });
      if ((c?.n ?? 0) > OFFLINE_CLAIMS_PER_DAY) {
        tx.rollback();
      }
      const [row] = await tx
        .select({ data: profiles.data })
        .from(profiles)
        .where(eq(profiles.accountId, id))
        .for('update');
      const r = reward(loadProfile(row?.data), summary, day);
      await tx
        .update(profiles)
        .set({ data: r.profile, updatedAt: sql`now()` })
        .where(eq(profiles.accountId, id));
      return { ok: true as const, rewards: r };
    })
    .catch((e: unknown) => {
      if (e instanceof Error && /rollback/i.test(e.name + e.message))
        return { ok: false as const, why: 'limit' as const };
      throw e;
    });
}

export async function deleteAccount(db: Db, id: string): Promise<void> {
  await db.delete(accounts).where(eq(accounts.id, id));
}
