import { botInput, hashState, step } from '@fitil/sim';
import type { GameState, Input } from '@fitil/sim';
import { CHAR_IDS, MODE_IDS, THEMES, cleanOutfit } from '@fitil/content';
import type { ModeId } from '@fitil/content';
import { buildOnline, cleanName, maxHumans } from './build.ts';
import { isTeamMode } from '@fitil/sim';
import { DEFAULT_CFG, END_TICKS, HASH_EVERY, NO_INPUT, decodeInput, encodeInput } from './protocol.ts';
import type {
  EndMsg,
  FrameMsg,
  LobbyMsg,
  MatchResult,
  MeMsg,
  RoomCfg,
  RoomPhase,
  Seat,
  SlotInfo,
  SnapMsg,
  WireInput,
} from './protocol.ts';

/** Câte input-uri poate aștepta un jucător (~100 ms): cu jitter coada ar crește și n-ar mai scădea, adăugând latență; peste, cele vechi se contopesc. */
const MAX_QUEUE = 2;
const LEVELS = ['easy', 'normal', 'hard', 'insane'] as const;

interface Queued {
  q: number;
  inp: Input;
}

/**
 * Logica autoritară a unei camere, fără rețea și fără timere: lobby, start, cozile de input,
 * tick-ul (un cadru pe tick), reconectarea și preluarea sloturilor de către boți.
 * `ArenaRoom` (Colyseus) doar o apelează și trimite mesajele.
 */
export class ArenaHost {
  phase: RoomPhase = 'lobby';
  cfg: RoomCfg = { ...DEFAULT_CFG };
  readonly seats: Seat[] = [];
  s: GameState | null = null;
  slots: SlotInfo[] = [];
  /** sid → id-ul jucătorului din simulare, pentru meciul curent. */
  private pid = new Map<string, number>();
  private queues = new Map<number, Queued[]>();
  private lastQ = new Map<number, number>();
  private last: (Input | undefined)[] = [];
  private acks: number[] = [];
  private ctl: [number, null | RoomCfg['bots']][] = [];
  private endT = 0;
  private seed = 0;
  private kills: number[] = [];
  private boxes: number[] = [];
  /** Oamenii de la start (sid + id în simulare) și cei care au plecat între timp. */
  private starters: { sid: string; pid: number; ch: string | null; name: string }[] = [];
  private left = new Set<string>();
  /** Rezultatul ultimului meci încheiat (pentru conturi); `finish()` îl umple. */
  result: MatchResult | null = null;
  /** Joc rapid: secunde până la pornirea automată (le ține camera, după ceas). */
  startIn: number | null = null;

  /** `quick` = cameră publică de joc rapid pe un mod fix (fără gazdă care configurează). */
  constructor(
    readonly code: string,
    readonly quick: { mode: ModeId; theme: string } | null = null,
  ) {
    if (quick) this.cfg = { ...this.cfg, mode: quick.mode, theme: quick.theme };
  }

  get host(): string {
    return this.seats[0]?.sid ?? '';
  }

  lobby(): LobbyMsg {
    return {
      code: this.code,
      phase: this.phase,
      host: this.host,
      cfg: this.cfg,
      seats: this.seats.map((s) => ({ ...s })),
      max: maxHumans(this.cfg.mode),
      quick: this.quick !== null,
      startIn: this.startIn,
    };
  }

  /** Locuri libere în lobby (joc rapid: camera se umple până la maximul modului). */
  get full(): boolean {
    return this.seats.length >= maxHumans(this.cfg.mode);
  }

  /** Un om intră în lobby. Întoarce motivul refuzului, dacă e cazul. */
  join(sid: string, me: MeMsg | string = {}): string | null {
    if (this.phase !== 'lobby') return 'The match already started.';
    if (this.seats.length >= (this.quick ? maxHumans(this.cfg.mode) : 4)) return 'The room is full.';
    const m = typeof me === 'string' ? { name: me } : (me ?? {});
    this.seats.push({
      sid,
      name: cleanName(m.name, `Player ${this.seats.length + 1}`),
      connected: true,
      ch: 'bubu',
      outfit: cleanOutfit(null),
    });
    this.setMe(sid, { ch: m.ch, outfit: m.outfit });
    return null;
  }

  /** Un om își schimbă personajul, ținuta sau numele în lobby. */
  setMe(sid: string, m: MeMsg): boolean {
    const seat = this.seats.find((s) => s.sid === sid);
    if (!seat || this.phase !== 'lobby' || !m || typeof m !== 'object') return false;
    if (typeof m.ch === 'string' && CHAR_IDS.includes(m.ch)) seat.ch = m.ch;
    if (m.outfit) seat.outfit = cleanOutfit(m.outfit);
    if (m.name !== undefined) seat.name = cleanName(m.name, seat.name);
    return true;
  }

  /** Conexiunea a căzut: jucătorul stă pe loc până revine (sau până expiră reconectarea). */
  drop(sid: string): void {
    const seat = this.seats.find((s) => s.sid === sid);
    if (seat) seat.connected = false;
    const pid = this.pid.get(sid);
    if (pid !== undefined) {
      this.queues.set(pid, []);
      this.last[pid] = NO_INPUT;
    }
  }

  reconnect(sid: string): void {
    const seat = this.seats.find((s) => s.sid === sid);
    if (seat) seat.connected = true;
  }

  /** Omul a plecat definitiv: în meci, slotul lui devine bot. */
  leave(sid: string): void {
    const i = this.seats.findIndex((s) => s.sid === sid);
    if (i >= 0) this.seats.splice(i, 1);
    const pid = this.pid.get(sid);
    if (pid !== undefined && this.s) {
      this.left.add(sid);
      this.pid.delete(sid);
      this.ctl.push([pid, this.cfg.bots]);
    }
  }

  setCfg(sid: string, c: Partial<RoomCfg>): boolean {
    if (sid !== this.host || this.phase !== 'lobby' || this.quick) return false;
    const next = { ...this.cfg };
    if (c.mode && (MODE_IDS as readonly string[]).includes(c.mode)) next.mode = c.mode;
    if (c.theme && THEMES.some((t) => t.id === c.theme)) next.theme = c.theme;
    if (c.bots && (LEVELS as readonly string[]).includes(c.bots)) next.bots = c.bots;
    if (typeof c.classic === 'boolean') next.classic = c.classic;
    if (typeof c.extras === 'boolean') next.extras = c.extras;
    this.cfg = next;
    return true;
  }

  /** Gazda pornește meciul. `seed` vine de la server; `aspect` e proporția ecranului gazdei. */
  start(sid: string, seed: number, aspect: number): boolean {
    if (sid !== this.host || this.phase !== 'lobby' || this.quick) return false;
    return this.launch(seed, aspect);
  }

  /** Joc rapid: camera pornește singură (plină sau după numărătoare). */
  startAuto(seed: number, aspect: number): boolean {
    if (!this.quick || this.phase !== 'lobby' || !this.seats.length) return false;
    return this.launch(seed, aspect);
  }

  private launch(seed: number, aspect: number): boolean {
    const a = Number.isFinite(aspect) ? Math.min(3, Math.max(0.3, aspect)) : 1.6;
    const players = this.seats.slice(0, maxHumans(this.cfg.mode));
    this.startIn = null;
    this.seed = seed >>> 0;
    const b = buildOnline(this.cfg, seed >>> 0, a, players);
    this.s = b.state;
    this.slots = b.slots;
    this.pid.clear();
    this.queues.clear();
    this.lastQ.clear();
    this.last = [];
    this.acks = b.state.players.map(() => -1);
    this.ctl = [];
    this.endT = 0;
    this.result = null;
    this.kills = b.state.players.map(() => 0);
    this.boxes = b.state.players.map(() => 0);
    this.left.clear();
    this.starters = [];
    players.forEach((p, k) => {
      const id = b.humans[k]!;
      this.starters.push({ sid: p.sid, pid: id, ch: b.slots[id]?.ch ?? null, name: p.name });
      this.pid.set(p.sid, id);
      this.queues.set(id, []);
      this.last[id] = NO_INPUT;
      this.acks[id] = 0;
    });
    this.phase = 'play';
    return true;
  }

  playerOf(sid: string): number {
    return this.pid.get(sid) ?? -1;
  }

  /** Un input de la client; cele vechi sau duplicate se ignoră. */
  input(sid: string, q: unknown, w: unknown): void {
    const pid = this.pid.get(sid);
    const n = Number(q);
    if (pid === undefined || !Number.isSafeInteger(n) || n <= (this.lastQ.get(pid) ?? 0)) return;
    this.lastQ.set(pid, n);
    const queue = this.queues.get(pid)!;
    queue.push({ q: n, inp: decodeInput(w) });
    while (queue.length > MAX_QUEUE) {
      // cele mai vechi se pierd, dar bomba și detonarea trec mai departe
      const old = queue.shift()!;
      const next = queue[0]!;
      if (old.inp.bomb && !next.inp.bomb) next.inp.bomb = old.inp.bomb;
      if (old.inp.detonate) next.inp.detonate = true;
      if (old.inp.super) next.inp.super = true;
      if (old.inp.swap) next.inp.swap = true;
    }
  }

  private consume(pid: number): Input {
    const e = this.queues.get(pid)?.shift();
    const prev = this.last[pid] ?? NO_INPUT;
    // fără input nou: continuă direcția de dinainte, fără bombă
    const inp = e ? e.inp : prev.face === undefined ? { dir: prev.dir } : { dir: prev.dir, face: prev.face };
    if (e) this.acks[pid] = e.q;
    this.last[pid] = inp;
    return inp;
  }

  /** Avansează meciul cu un tick și întoarce cadrul de trimis (null dacă nu e meci). */
  tick(): FrameMsg | null {
    const s = this.s;
    if (!s || this.phase !== 'play') return null;
    const c = this.ctl.splice(0);
    for (const [pid, bot] of c) s.players[pid]!.bot = bot;
    const wire: (WireInput | null)[] = [];
    const inputs = s.players.map((p) => {
      if (p.bot !== null) {
        wire.push(null);
        return botInput(s, p.id);
      }
      const w = encodeInput(this.consume(p.id));
      wire.push(w);
      return decodeInput(w);
    });
    step(s, inputs);
    for (const e of s.events) {
      if (e.type === 'death' && e.killerId !== null && e.killerId !== e.player) {
        const k = s.players[e.killerId];
        const v = s.players[e.player];
        if (k && v && !(isTeamMode(s.rules) && k.team === v.team)) this.kills[e.killerId]!++;
      } else if (e.type === 'boxDestroyed' && e.owner >= 0)
        this.boxes[e.owner] = (this.boxes[e.owner] ?? 0) + 1;
    }
    const f: FrameMsg = { t: s.tick, i: wire, a: this.acks.slice() };
    if (c.length) f.c = c;
    if (s.tick % HASH_EVERY === 0) f.h = hashState(s);
    if (s.result) this.endT++;
    return f;
  }

  /** Meciul s-a încheiat (după animațiile de final)? Atunci camera revine în lobby. */
  finish(): EndMsg | null {
    const s = this.s;
    if (!s || this.phase !== 'play' || this.endT < END_TICKS) return null;
    const end = { t: s.tick, h: hashState(s) };
    this.result = this.summary(s);
    this.phase = 'lobby';
    this.s = null;
    this.pid.clear();
    return end;
  }

  /** Locuri: în FFA / duel după momentul eliminării (cel rămas primul); în echipe 1 / 2. */
  private summary(s: GameState): MatchResult {
    const team = isTeamMode(s.rules);
    const out = [...s.players].sort(
      (a, b) => (b.alive ? Infinity : b.deathTick) - (a.alive ? Infinity : a.deathTick) || a.id - b.id,
    );
    return {
      mode: this.cfg.mode,
      seed: this.seed,
      ticks: s.tick,
      players: this.starters.map((st) => {
        const p = s.players[st.pid]!;
        const won = team ? s.result?.team === p.team : s.result?.winner === p.id;
        const place = team ? (won ? 1 : 2) : won ? 1 : Math.max(2, out.findIndex((o) => o.id === p.id) + 1);
        return {
          sid: st.sid,
          pid: st.pid,
          ch: st.ch,
          name: st.name,
          place,
          won,
          team,
          kills: this.kills[st.pid] ?? 0,
          boxes: this.boxes[st.pid] ?? 0,
          left: this.left.has(st.sid),
        };
      }),
    };
  }

  snapFor(sid: string): SnapMsg | null {
    const s = this.s;
    if (!s) return null;
    const me = this.playerOf(sid);
    return {
      state: JSON.stringify(s),
      me,
      slots: this.slots,
      cfg: this.cfg,
      ack: me >= 0 ? (this.acks[me] ?? 0) : 0,
      q: me >= 0 ? (this.lastQ.get(me) ?? 0) : 0,
      last: s.players.map((p) => (p.bot === null ? encodeInput(this.last[p.id] ?? NO_INPUT) : null)),
    };
  }
}
