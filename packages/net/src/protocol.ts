import type { BotKind, BotLevel, Dir, Input } from '@fitil/sim';
import type { ModeId, Outfit, Profile, Rewards } from '@fitil/content';

/** Configurația camerei, aleasă de gazdă în lobby. */
export interface RoomCfg {
  mode: ModeId;
  theme: string;
  bots: BotLevel;
  /** Clasic: fără personaje și fără încărcări (jocul original, Q-005). */
  classic: boolean;
  /** Evenimente de arenă și bonusurile noi (Faza 4); gazda le poate opri. */
  extras: boolean;
}

export const DEFAULT_CFG: RoomCfg = {
  mode: 'ffa',
  theme: 'clasic',
  bots: 'normal',
  classic: false,
  extras: true,
};

/** Un loc ocupat de un om în cameră (în ordinea intrării; primul e gazda). */
export interface Seat {
  sid: string;
  name: string;
  connected: boolean;
  /** Personajul ales și ce poartă (proprietatea nu se verifică încă — conturile vin în Faza 6). */
  ch: string;
  outfit: Outfit;
}

/** Ce trimite clientul despre el (la intrare și când își schimbă personajul în lobby). */
export interface MeMsg {
  name?: string;
  ch?: string;
  outfit?: Partial<Outfit>;
}

export type RoomPhase = 'lobby' | 'play';

/** Server → client: starea lobby-ului (la orice schimbare). */
export interface LobbyMsg {
  code: string;
  phase: RoomPhase;
  host: string;
  cfg: RoomCfg;
  seats: Seat[];
  /** Câți oameni încap în modul ales. */
  max: number;
  /** Cameră publică (joc rapid): fără gazdă care configurează, pornește singură. */
  quick: boolean;
  /** Joc rapid: secunde până la pornire (null = așteaptă jucători). */
  startIn: number | null;
}

/** Numele, culoarea și vocea unui jucător din meci (ca `Slot` din client). */
export interface SlotInfo {
  name: string;
  color: string;
  bot: boolean;
  voice: number;
  /** Personajul (null = clasic) și cosmeticele (doar oamenii). */
  ch: string | null;
  outfit: Outfit | null;
}

/** Input compact pe fir: [dir, bomb, detonate, face, super, swap, slide], -1 = lipsă. */
export type WireInput = [number, number, number, number, number, number, number];

/** Server → client: starea completă (start, reconectare, desync). */
export interface SnapMsg {
  /** `GameState` serializat JSON (exact, independent de codificarea transportului). */
  state: string;
  /** Id-ul jucătorului tău în simulare (-1 = spectator). */
  me: number;
  slots: SlotInfo[];
  cfg: RoomCfg;
  /** Ultimul număr de secvență al tău aplicat deja în `state`. */
  ack: number;
  /** Ultimul număr de secvență primit de server (după o reîncărcare, numerotarea continuă de aici). */
  q: number;
  /** Ultimele input-uri ale oamenilor (pentru predicție). */
  last: (WireInput | null)[];
}

/**
 * Server → client: un tick. `i[pid]` = input-ul omului `pid` folosit la acest tick (null = bot,
 * calculat local). `a[pid]` = ultimul număr de secvență consumat. `h` = hash-ul stării după tick
 * (la fiecare `HASH_EVERY` tick-uri). `c` = sloturi care își schimbă controlul înainte de tick.
 */
export interface FrameMsg {
  t: number;
  i: (WireInput | null)[];
  a: number[];
  h?: string;
  c?: [number, BotKind | null][];
}

/** Server → client: meciul s-a terminat (hash-ul final, pentru verificare). */
export interface EndMsg {
  t: number;
  h: string;
}

/** Client → server: un input numerotat. */
export interface InputMsg {
  q: number;
  i: WireInput;
}

export const HASH_EVERY = 20;
/** Cât mai rulează serverul după rezultat (animațiile de final), în tick-uri. */
export const END_TICKS = 70;
export const RECONNECT_S = 15;
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export const NO_INPUT: Input = { dir: null };

export function encodeInput(inp: Input): WireInput {
  return [
    inp.dir ?? -1,
    inp.bomb ?? 0,
    inp.detonate ? 1 : 0,
    inp.face ?? -1,
    inp.super ? 1 : 0,
    inp.swap ? 1 : 0,
    inp.slide ? 1 : 0,
  ];
}

const asDir = (v: number): Dir | null => (v >= 0 && v <= 3 ? (v as Dir) : null);

/** Decodează (și validează) un input venit de pe fir. */
export function decodeInput(w: unknown): Input {
  if (!Array.isArray(w)) return { dir: null };
  const [d, b, x, f, su, sw, sl] = w as unknown[];
  const inp: Input = { dir: asDir(Number(d)) };
  const bomb = Number(b);
  if (bomb === 1 || bomb === 2) inp.bomb = bomb;
  if (x === 1) inp.detonate = true;
  if (su === 1) inp.super = true;
  if (sw === 1) inp.swap = true;
  if (sl === 1) inp.slide = true;
  const face = asDir(Number(f));
  if (face !== null) inp.face = face;
  return inp;
}

/** Un om din meciul încheiat (pentru conturi, trofee și recompense — le scrie doar serverul). */
export interface SeatResult {
  sid: string;
  /** Id-ul în simulare. */
  pid: number;
  ch: string | null;
  name: string;
  /** 1 = primul. În echipe: 1 echipa câștigătoare, 2 cealaltă. */
  place: number;
  won: boolean;
  team: boolean;
  kills: number;
  boxes: number;
  /** A ieșit din cameră înainte de final (boții i-au luat locul). */
  left: boolean;
}

export interface MatchResult {
  mode: ModeId;
  seed: number;
  ticks: number;
  players: SeatResult[];
}

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
