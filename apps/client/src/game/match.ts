import {
  SLIDE_SPEED,
  TICK_MS,
  U,
  botInput,
  doomBomb,
  inDoomDanger,
  isTeamMode,
  startChallenge,
  step,
  trackChallenge,
  tutorialDone,
  tutorialFailed,
} from '@fitil/sim';
import type { ChallengeProgress, Dir, GameEvent, GameState, Input, MaxStat, Tutorial } from '@fitil/sim';
import { DEATH_MSG, HERO_LINES, emoteById, fatalityById, shopItem } from '@fitil/content';
import { DAILY_MAX_TICKS, encodeInput } from '@fitil/net';
import type { NetClient, WireInput } from '@fitil/net';
import { build, isTeamKind } from './setup.ts';
import type { Built, Me, PlayKind, Slot } from './setup.ts';
import type { BotLevel } from '@fitil/sim';

export type HeroKind = MaxStat | 'win' | 'team';

export interface Hero {
  t: number;
  kind: HeroKind;
  player: number;
  text: string;
  dur: number;
}

/** Ultima eliminare din rundă: slow-motion și zoom pe victimă (D-061). */
export interface Finale {
  /** Secunde reale de la început. */
  t: number;
  player: number;
}

/** Cât ține momentul final (s, timp real). */
export const FINALE_S = 1;

/** Cât ține încetinirea „bye bye” (s, timp real). */
export const DOOM_S = 1.3;

export interface Doom {
  t: number;
  bomb: number | null;
  said: boolean;
}

/** Evenimente pentru UI/audio/efecte: cele din simulare plus cele ale clientului. */
export type MatchEvent =
  | GameEvent
  | { type: 'hero'; hero: Hero }
  | { type: 'fatality'; player: number; killer: number; id: string }
  | { type: 'emote'; player: number; id: string }
  | { type: 'doomStart' }
  | { type: 'bye' }
  | { type: 'doomEnd' }
  | { type: 'ko'; msg: string }
  | { type: 'over'; win: boolean; draw: boolean; winner: number | null; team: number | null }
  | { type: 'tutorialDone' }
  | { type: 'tutorialFail' }
  | { type: 'challenge'; progress: ChallengeProgress };

export interface HumanControl {
  /** Direcția dorită în tick-ul curent (deja convertită din joystick/tastatură/cameră). */
  dir: () => Dir | null;
  /** Direcția privirii camerei în 3D (undefined în 2D). */
  face: () => Dir | undefined;
}

/**
 * Un meci: ține starea simulării, o avansează la 20 Hz după timpul real (offline cu slow-motion
 * la „bye bye” și la momentele de glorie) și transmite evenimentele spre randare, audio și UI.
 * Online (`net`), starea vine din cadrele serverului, iar jucătorul local e afișat din predicție (D-031).
 */
export class Match {
  private state: GameState;
  readonly slots: Slot[];
  readonly tutorial: Tutorial | null;
  readonly team: boolean;
  challenge: ChallengeProgress | null = null;
  /** Provocarea zilei: input-ul jucătorului la fiecare tick, trimis serverului pentru verificare. */
  readonly log: WireInput[] | null;
  /** Poziția de dinainte de ultimul tick (interpolare). */
  private prev = new Map<string, [number, number]>();
  private acc = 0;
  alpha = 0;
  /** Timp vizual (s), încetinit odată cu jocul. */
  time = 0;
  paused = false;
  doom: Doom | null = null;
  hero: Hero | null = null;
  finale: Finale | null = null;
  /** Bomba pentru care „bye bye” a rulat deja (nu se reia pentru aceeași). */
  private lastDoom: number | null = null;
  /** Fatalitatea jucată pe fiecare victimă (aleasă din ținuta ucigașului). */
  readonly fats = new Map<number, string>();
  /** Emote-urile de pe ecran (id + secunde scurse). */
  readonly emotes = new Map<number, { id: string; t: number }>();
  private overT = 0;
  private done = false;
  private koShown = false;
  private taps: (1 | 2)[] = [];
  private detonateReq = false;
  private superReq = false;
  private swapReq = false;
  private listeners: ((e: MatchEvent) => void)[] = [];
  private tutDone = false;
  /** Online: poziția prezisă a jucătorului local, înainte și după ultimul tick. */
  private pred: [number, number] | null = null;
  private predPrev: [number, number] | null = null;

  constructor(
    readonly kind: PlayKind,
    readonly bots: BotLevel,
    b: Built,
    private control: HumanControl,
    /** Id-ul jucătorului local în simulare. */
    readonly meId = 0,
    readonly net: NetClient | null = null,
  ) {
    this.state = b.s;
    this.slots = b.slots;
    this.tutorial = b.tutorial;
    this.team = net ? isTeamMode(b.s.rules) : isTeamKind(kind);
    if (kind.type === 'challenge') this.challenge = startChallenge(kind.id);
    this.log = kind.type === 'challenge' && kind.daily ? [] : null;
    this.snapshot();
  }

  static offline(
    kind: PlayKind,
    bots: BotLevel,
    seed: number,
    aspect: number,
    control: HumanControl,
    me?: Me,
  ): Match {
    return new Match(kind, bots, build(kind, bots, seed, aspect, me), control);
  }

  /** Starea de randat (online: starea afișată din cadrele serverului). */
  get s(): GameState {
    return this.net?.view ?? this.state;
  }

  on(fn: (e: MatchEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: MatchEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  get me() {
    return this.s.players[this.meId]!;
  }

  tap(kind: 1 | 2): void {
    if (this.taps.length < 3) this.taps.push(kind);
  }

  detonate(): void {
    this.detonateReq = true;
  }

  useSuper(): void {
    this.superReq = true;
  }

  swapSpecial(): void {
    this.swapReq = true;
  }

  /** Are jucătorul bombe cu detonator pe hartă? (arată butonul BUM!) */
  get hasRemote(): boolean {
    return this.me.alive && this.s.bombs.some((b) => b.owner === this.meId && b.remote && b.held === null);
  }

  /** Viteza timpului: 40% la „bye bye”, 30% la maxime, 100% altfel. */
  private get scale(): number {
    if (this.net) return 1; // online simularea nu se încetinește (D-017)
    if (this.doom) return this.me.alive ? 0.55 : 0.7;
    if (this.finale) return 0.35;
    if (this.hero && this.hero.kind !== 'win' && this.hero.kind !== 'team') return 0.5;
    return 1;
  }

  update(dtMs: number): void {
    if (this.paused && !this.net) return;
    const dt = Math.min(dtMs, 250) * this.scale;
    this.time += dt / 1000;
    this.updateCinematics(dt / 1000);
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK_MS && n++ < 5) {
      this.acc -= TICK_MS;
      this.tick();
    }
    this.alpha = Math.min(1, this.acc / TICK_MS);
    if (this.s.result && !this.done) {
      this.overT += dt / 1000;
      const win = this.won();
      const wait = this.s.rules.mode === 'ctf' ? (win ? 1.8 : 0.6) : win ? 2.9 : 1.6;
      if (this.overT > wait) {
        this.done = true;
        this.hero = null;
        this.emit({
          type: 'over',
          win,
          draw: this.s.result.winner === null && this.s.result.team === null,
          winner: this.s.result.winner,
          team: this.s.result.team,
        });
      }
    }
  }

  private won(): boolean {
    const r = this.s.result;
    if (!r) return false;
    return isTeamMode(this.s.rules) ? r.team === this.me.team : r.winner === this.meId;
  }

  private snapshot(): void {
    for (const p of this.s.players) this.prev.set(`p${p.id}`, [p.px, p.py]);
    for (const c of this.s.spiders) this.prev.set(`s${c.id}`, [c.px, c.py]);
    for (const c of this.s.clouds) this.prev.set(`c${c.id}`, [c.px, c.py]);
    for (const f of this.s.mission?.friends ?? []) this.prev.set(`f${f.id}`, [f.px, f.py]);
  }

  private tick(): void {
    if (this.net) return this.netTick(this.net);
    const s = this.s;
    this.snapshot();
    const inputs: (Input | undefined)[] = s.players.map((p) =>
      p.bot !== null ? botInput(s, p.id) : undefined,
    );
    inputs[this.meId] = this.localInput();
    if (this.log && this.log.length < DAILY_MAX_TICKS && this.challenge?.status === 'playing')
      this.log.push(encodeInput(inputs[this.meId]!));
    step(s, inputs);
    for (const e of s.events) this.handle(e);
    if (this.tutorial && !this.tutDone) {
      if (tutorialDone(s, this.tutorial)) {
        this.tutDone = true;
        this.emit({ type: 'tutorialDone' });
      } else if (tutorialFailed(s)) {
        this.tutDone = true;
        this.emit({ type: 'tutorialFail' });
      }
    }
    if (this.challenge && this.challenge.status === 'playing') {
      trackChallenge(this.challenge, s);
      if (this.challenge.status !== 'playing' || s.events.length)
        this.emit({ type: 'challenge', progress: this.challenge });
    }
    this.checkDoom();
  }

  private localInput(): Input {
    const bomb = this.taps.shift() ?? 0;
    const inp: Input = this.paused
      ? { dir: null }
      : { dir: this.control.dir(), bomb, detonate: this.detonateReq };
    if (!this.paused && this.superReq) inp.super = true;
    if (!this.paused && this.swapReq) inp.swap = true;
    const face = this.control.face();
    if (face !== undefined && !this.paused) inp.face = face;
    this.detonateReq = false;
    this.superReq = false;
    this.swapReq = false;
    return inp;
  }

  /**
   * Un tick online: trimite input-ul local, avansează starea afișată cu un cadru (două dacă
   * bufferul a crescut) și recalculează predicția jucătorului local.
   */
  private netTick(net: NetClient): void {
    net.send(this.localInput());
    const n = net.buffered >= 4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.snapshot();
      if (!net.stepView()) break;
      for (const e of this.s.events) this.handle(e);
    }
    const p = net.predict()?.players[this.meId];
    this.predPrev = this.pred;
    this.pred = p ? [p.px, p.py] : null;
    this.checkDoom();
  }

  private handle(e: GameEvent): void {
    this.emit(e);
    const s = this.s;
    if (e.type === 'maxed' && e.player === this.meId) this.startHero(e.stat, this.meId);
    if (e.type === 'capture' && e.player === this.meId) this.startHero('team', this.meId, 1.8);
    if (e.type === 'death') this.onDeath(e);
    if (e.type === 'respawn') this.fats.delete(e.player);
    if (e.type === 'roundEnd') {
      if (this.won()) {
        const cel = this.me.alive ? this.me : s.players.find((p) => p.alive && p.team === this.me.team);
        if (cel) this.startHero(this.team ? 'team' : 'win', cel.id, 2.6);
      }
    }
    if (
      e.type === 'death' &&
      e.player === this.meId &&
      !s.rules.respawnTicks &&
      !this.koShown &&
      !this.tutorial &&
      !s.mission
    ) {
      this.koShown = true;
      const k = e.killerId;
      let msg =
        e.cause !== 'flame'
          ? DEATH_MSG[e.cause]
          : k === null || k === this.meId
            ? DEATH_MSG.self
            : DEATH_MSG.flame.replace('{k}', this.slots[k]?.name ?? '?');
      if (this.team && !s.result) msg += ' Your team is still fighting.';
      if (!s.result || !this.won()) this.emit({ type: 'ko', msg });
    }
    if (e.type === 'death' && e.player === this.meId && s.rules.mode === 'ctf') {
      const k = e.killerId;
      const who = k !== null && k !== this.meId ? `Toasted by ${this.slots[k]?.name ?? '?'}! ` : '';
      this.emit({ type: 'ko', msg: `${who}Back in 3s…` });
    }
  }

  /** Fatalitatea ucigașului (doar pentru o lovitură de flacără dată altcuiva) și momentul final al rundei. */
  private onDeath(e: Extract<GameEvent, { type: 'death' }>): void {
    const s = this.s;
    const k = e.killerId;
    if (e.cause === 'flame' && k !== null && k !== e.player) {
      const fat = fatalityById(shopItem(this.slots[k]?.outfit?.fatality)?.fatality);
      if (fat) {
        this.fats.set(e.player, fat.id);
        this.emit({ type: 'fatality', player: e.player, killer: k, id: fat.id });
      }
    }
    if (this.tutorial || s.mission || s.inf || s.rules.respawnTicks || this.doom) return;
    const alive = s.players.filter((p) => p.alive);
    const sides = new Set(alive.map((p) => (isTeamMode(s.rules) ? p.team : p.id)));
    if (s.players.length > 1 && sides.size <= 1) this.finale = { t: 0, player: e.player };
  }

  private startHero(kind: HeroKind, player: number, dur = 1): void {
    const p = this.s.players[player];
    if (!p || !p.alive || this.doom) return;
    const lines = HERO_LINES[kind];
    const text = lines[Math.floor(Math.random() * lines.length)]!;
    this.hero = { t: 0, kind, player, text, dur };
    this.emit({ type: 'hero', hero: this.hero });
  }

  private checkDoom(): void {
    const me = this.me;
    if (this.doom || !me.alive || this.s.result || this.tutorial) return;
    if (this.s.rules.mode === 'ctf' || this.s.rules.respawnTicks) return;
    // în misiuni „bye bye” apare doar dacă lovitura te-ar omorî
    if (this.s.mission && me.hp > 35) return;
    const b = doomBomb(this.s, me);
    if (b === null) return;
    if (b === this.lastDoom) return;
    this.lastDoom = b;
    this.doom = { t: 0, bomb: b, said: false };
    this.hero = null;
    this.emit({ type: 'doomStart' });
  }

  /** Emote-ul echipat de jucătorul local (doar offline: online nu se sincronizează încă). */
  get myEmote(): string | undefined {
    return this.net ? undefined : (shopItem(this.slots[this.meId]?.outfit?.emote)?.emote ?? undefined);
  }

  emote(): void {
    const id = this.myEmote;
    if (!id || !this.me.alive || this.paused) return;
    this.emotes.set(this.meId, { id, t: 0 });
    this.emit({ type: 'emote', player: this.meId, id });
  }

  private updateCinematics(scaled: number): void {
    const me = this.me;
    // momentele cinematice se măsoară în timp real, ca încetinirea să nu le lungească
    const dt = scaled / (this.net ? 1 : this.scale);
    for (const [k, e] of this.emotes) {
      e.t += dt;
      if (e.t > (emoteById(e.id)?.dur ?? 0)) this.emotes.delete(k);
    }
    if (this.finale) {
      this.finale.t += dt;
      if (this.finale.t >= FINALE_S) this.finale = null;
    }
    const d = this.doom;
    if (d) {
      d.t += dt;
      const deadFor = me.alive ? 0 : (this.s.tick - me.deathTick) * (TICK_MS / 1000);
      if (d.t > 0.9 && !d.said) {
        d.said = true;
        this.emit({ type: 'bye' });
      }
      if (
        (me.alive && (d.t > DOOM_S || (d.t > 0.1 && !inDoomDanger(this.s, me)))) ||
        (!me.alive && deadFor >= 1)
      ) {
        this.doom = null;
        this.emit({ type: 'doomEnd' });
      }
    }
    const h = this.hero;
    if (h) {
      h.t += dt;
      const p = this.s.players[h.player];
      if (h.t > h.dur || !p?.alive || this.doom) this.hero = null;
    }
  }

  /* ---------- interpolare ---------- */

  /** Poziția interpolată (în pătrățele) a unei entități: `p<id>` jucător, `s<id>` păianjen, `c<id>` nor. */
  lerp(key: string, px: number, py: number): [number, number] {
    if (this.net && this.pred && key === `p${this.meId}` && this.me.alive) {
      // jucătorul local online: între ultimele două predicții
      const [bx, by] = this.pred;
      const [ax, ay] = this.predPrev ?? this.pred;
      if (Math.abs(bx - ax) + Math.abs(by - ay) > 1.5 * U) return [bx / U, by / U];
      return [(ax + (bx - ax) * this.alpha) / U, (ay + (by - ay) * this.alpha) / U];
    }
    const pr = this.prev.get(key);
    if (!pr) return [px / U, py / U];
    const [ax, ay] = pr;
    if (Math.abs(px - ax) + Math.abs(py - ay) > 1.5 * U) return [px / U, py / U]; // teleport / revenire
    return [(ax + (px - ax) * this.alpha) / U, (ay + (py - ay) * this.alpha) / U];
  }

  /** Poziția vizuală a unei bombe (alunecare/zbor interpolate) și înălțimea de zbor (0–1). */
  bombPos(b: GameState['bombs'][number]): { x: number; y: number; lift: number } {
    const s = this.s;
    if (b.fly) {
      const f = b.fly;
      const e = Math.min(1, (f.t + this.alpha) / f.dur);
      const dx = [0, 0, -1, 1][f.dir]!;
      const dy = [-1, 1, 0, 0][f.dir]!;
      const d = f.steps * e;
      const wrap = (v: number, n: number) => 1 + ((((v - 1) % (n - 2)) + (n - 2)) % (n - 2));
      return { x: wrap(f.sx + dx * d, s.W), y: wrap(f.sy + dy * d, s.H), lift: Math.sin(Math.PI * e) };
    }
    if (b.slide !== null) {
      const pr = Math.max(0, Math.min(0.99, (b.prog + SLIDE_SPEED * this.alpha) / U));
      return { x: b.x + [0, 0, -1, 1][b.slide]! * pr, y: b.y + [-1, 1, 0, 0][b.slide]! * pr, lift: 0 };
    }
    return { x: b.x, y: b.y, lift: 0 };
  }
}
