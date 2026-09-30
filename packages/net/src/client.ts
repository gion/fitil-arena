import { botInput, hashState, step } from '@fitil/sim';
import type { GameState, Input } from '@fitil/sim';
import { decodeInput, encodeInput } from './protocol.ts';
import type { EndMsg, FrameMsg, LobbyMsg, RoomCfg, SlotInfo, SnapMsg } from './protocol.ts';

/** Legătura cu serverul (camera Colyseus, o buclă în memorie în teste, sau `lagLink` peste una din ele). */
export interface Link {
  send(type: string, msg?: unknown): void;
  on(type: string, fn: (msg: never) => void): void;
}

/** Aplică un cadru pe o stare: schimbările de control, input-urile oamenilor, boții calculați local. */
export function applyFrame(s: GameState, f: FrameMsg): void {
  for (const [pid, bot] of f.c ?? []) s.players[pid]!.bot = bot;
  const inputs = s.players.map((p) => (p.bot !== null ? botInput(s, p.id) : decodeInput(f.i[p.id] ?? null)));
  step(s, inputs);
}

/** Peste câte cadre neafișate renunțăm la animație și sărim direct la starea confirmată. */
const SKIP_AFTER = 40;

/**
 * Partea de client a sincronizării (D-030, D-031):
 * - `auth`: starea confirmată, avansată imediat cu fiecare cadru primit (hash-uri verificate);
 * - `view`: aceeași stare, avansată de joc cu câte un cadru pe tick (jitter buffer) — de randat;
 * - `predict()`: `auth` + input-urile locale încă neconfirmate — poziția jucătorului local.
 */
export class NetClient {
  auth: GameState | null = null;
  view: GameState | null = null;
  me = -1;
  slots: SlotInfo[] = [];
  cfg: RoomCfg | null = null;
  lobby: LobbyMsg | null = null;
  end: EndMsg | null = null;
  desyncs = 0;
  /** Numărul de `snap`-uri primite (start + reconectări + resincronizări). */
  snaps = 0;
  private frames: FrameMsg[] = [];
  private pending: { q: number; inp: Input }[] = [];
  private seq = 0;
  private last: (Input | undefined)[] = [];
  private waitSnap = false;
  onLobby: (m: LobbyMsg) => void = () => {};
  onSnap: (m: SnapMsg) => void = () => {};
  onEnd: (m: EndMsg) => void = () => {};

  constructor(readonly link: Link) {
    link.on('lobby', (m: LobbyMsg) => {
      this.lobby = m;
      this.onLobby(m);
    });
    link.on('snap', (m: SnapMsg) => this.handleSnap(m));
    link.on('f', (f: FrameMsg) => this.handleFrame(f));
    link.on('end', (m: EndMsg) => {
      this.end = m;
      this.onEnd(m);
    });
  }

  private handleSnap(m: SnapMsg): void {
    this.snaps++;
    this.auth = JSON.parse(m.state) as GameState;
    this.view = JSON.parse(m.state) as GameState;
    this.me = m.me;
    this.slots = m.slots;
    this.cfg = m.cfg;
    this.end = null;
    this.frames = [];
    this.pending = this.pending.filter((p) => p.q > m.ack);
    this.last = m.last.map((w) => (w ? decodeInput(w) : undefined));
    this.waitSnap = false;
    this.onSnap(m);
  }

  private handleFrame(f: FrameMsg): void {
    const s = this.auth;
    if (!s || this.waitSnap || f.t <= s.tick) return;
    if (f.t !== s.tick + 1) return this.resync();
    applyFrame(s, f);
    f.i.forEach((w, pid) => (this.last[pid] = w ? decodeInput(w) : undefined));
    const ack = this.me >= 0 ? (f.a[this.me] ?? 0) : 0;
    while (this.pending.length && this.pending[0]!.q <= ack) this.pending.shift();
    this.frames.push(f);
    if (f.h && f.h !== hashState(s)) {
      this.desyncs++;
      this.resync();
    }
  }

  private resync(): void {
    this.waitSnap = true;
    this.link.send('resync');
  }

  /** Trimite input-ul local pentru tick-ul curent. */
  send(inp: Input): void {
    if (this.me < 0 || !this.auth || this.end) return;
    const q = ++this.seq;
    const w = encodeInput(inp);
    this.pending.push({ q, inp: decodeInput(w) });
    this.link.send('in', { q, i: w });
  }

  /** Cadre primite și încă neafișate. */
  get buffered(): number {
    return this.frames.length;
  }

  get unacked(): number {
    return this.pending.length;
  }

  /**
   * Avansează `view` cu un cadru. Întoarce false dacă nu există cadre.
   * Dacă s-au adunat prea multe (tab în fundal), sare direct la `auth` (fără evenimente).
   */
  stepView(): boolean {
    const v = this.view;
    if (!v || !this.auth || !this.frames.length) return false;
    if (this.frames.length > SKIP_AFTER) {
      this.view = structuredClone(this.auth);
      this.view.events = [];
      this.frames = [];
      return true;
    }
    applyFrame(v, this.frames.shift()!);
    return true;
  }

  /** Starea confirmată plus input-urile locale neconfirmate (ceilalți oameni: ultimul lor input). */
  predict(): GameState | null {
    if (!this.auth) return null;
    const s = structuredClone(this.auth);
    for (const { inp } of this.pending) {
      const inputs = s.players.map((p) => {
        if (p.id === this.me) return inp;
        if (p.bot !== null) return botInput(s, p.id);
        const l = this.last[p.id];
        return l ? { dir: l.dir, ...(l.face !== undefined ? { face: l.face } : {}) } : { dir: null };
      });
      step(s, inputs);
    }
    return s;
  }
}
