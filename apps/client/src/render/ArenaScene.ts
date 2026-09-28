import Phaser from 'phaser';
import {
  DEG,
  HARD,
  HOME,
  SHIFT_STEP,
  SOFT,
  TICK_HZ,
  U,
  idx,
  inBounds,
  isGold,
  shiftCells,
  targetAt,
} from '@fitil/sim';
import type { GameState, ItemType, Player } from '@fitil/sim';
import { TEAMS } from '@fitil/content';
import type { Theme } from '@fitil/content';
import { DPR } from '../display.ts';
import type { Match, MatchEvent } from '../game/match.ts';
import { FRIEND_COL } from './colors.ts';
import { DizzyFX } from './dizzy.ts';
import * as paint from './paint.ts';
import { TexBank } from './textures.ts';

type Img = Phaser.GameObjects.Image;

/** Refolosește imagini între cadre (fără alocări în bucla de randare). */
class Pool {
  private items: Img[] = [];
  private n = 0;
  constructor(
    private scene: Phaser.Scene,
    private depth: number,
  ) {}
  begin(): void {
    this.n = 0;
  }
  get(e: { key: string; ox: number; oy: number }, x: number, y: number): Img {
    let im = this.items[this.n];
    if (!im) {
      im = this.scene.add.image(0, 0, e.key).setDepth(this.depth);
      this.items.push(im);
    } else im.setTexture(e.key);
    this.n++;
    return im
      .setOrigin(e.ox, e.oy)
      .setPosition(x, y)
      .setVisible(true)
      .setAlpha(1)
      .setScale(1)
      .setRotation(0)
      .clearTint()
      .setDepth(this.depth);
  }
  end(): void {
    for (let i = this.n; i < this.items.length; i++) this.items[i]!.setVisible(false);
  }
  destroy(): void {
    for (const im of this.items) im.destroy();
    this.items = [];
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: number;
  s: number;
  g: number;
}

const hexNum = (c: string): number => parseInt(c.slice(1), 16);

const FACE: [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];
const DEPTH = {
  static: 0,
  tiles: 1,
  items: 2,
  fx: 3,
  bombs: 4,
  flames: 5,
  actors: 10,
  clouds: 60,
  top: 70,
  overlay: 80,
};

/**
 * Randarea 2D a arenei (Phaser, WebGL), la rezoluția fizică a ecranului.
 * Citește starea din `Match` (simularea) și nu modifică nimic din ea.
 */
export class ArenaScene extends Phaser.Scene {
  match: Match | null = null;
  theme!: Theme;
  /** Apelată la începutul fiecărui cadru (bucla aplicației: input, simulare, 3D). */
  onFrame: ((dtMs: number) => void) | null = null;
  /** Arena ca minimapă (vederile 3D). */
  mini = false;
  motion = true;
  /** Cadre pe secundă (pentru teste și raport). */
  fps = 0;

  private tex!: TexBank;
  private T = 32;
  private staticImg: Img | null = null;
  private staticHard: Uint8Array | null = null;
  private staticFor: GameState | null = null;
  private staticKey = '';
  private pools: Record<string, Pool> = {};
  private g!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private particles: Particle[] = [];
  private popIn = new Map<number, number>();
  private bolts: { x: number; y: number; t: number; seed: number }[] = [];
  private flash = 0;
  private shake = 0;
  private zoomK = 1;
  private walk = new Map<number, number>();
  private dizzy: DizzyFX | null = null;
  private fpsAcc = 0;
  private fpsN = 0;
  private rotK = 1;
  /** Camera în lumea infinită (pătrățele), urmărește lin jucătorul. */
  private camX = 1;
  private camY = 1;
  /** Fereastra vizibilă (pătrățele de lume). */
  private view = { x0: 0, x1: 0, y0: 0, y1: 0 };
  /** Tremuratul turnurilor lovite ("x,y" → secunde rămase) și flash-ul roșu la rănire. */
  private hitT = new Map<string, number>();
  private hurtT = 0;

  constructor() {
    super('arena');
  }

  create(): void {
    this.tex = new TexBank(this);
    this.g = this.add.graphics().setDepth(DEPTH.top);
    for (const [name, d] of Object.entries({
      ground: DEPTH.static + 0.5,
      tiles: DEPTH.tiles,
      over: DEPTH.tiles + 0.5,
      items: DEPTH.items,
      fx: DEPTH.fx,
      bombs: DEPTH.bombs,
      flames: DEPTH.flames,
      ctf: DEPTH.actors - 1,
      actors: DEPTH.actors,
      clouds: DEPTH.clouds,
      fly: DEPTH.clouds + 1,
      parts: DEPTH.top + 1,
      amb: DEPTH.top + 2,
    }))
      this.pools[name] = new Pool(this, d);
    const r = this.game.renderer;
    if (r instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      r.pipelines.addPostPipeline('DizzyFX', DizzyFX);
    }
  }

  setTheme(t: Theme): void {
    this.theme = t;
    this.staticKey = '';
  }

  setMatch(m: Match | null): void {
    this.match = m;
    this.particles = [];
    this.popIn.clear();
    this.bolts = [];
    this.walk.clear();
    this.crushed.clear();
    this.shake = 0;
    this.zoomK = 1;
    this.staticKey = '';
    this.hitT.clear();
    this.hurtT = 0;
    if (m) {
      this.camX = m.me.px / U;
      this.camY = m.me.py / U;
    }
    m?.on((e) => this.onEvent(e));
  }

  /** Dreptunghiul zonei de joc pe ecran (pixeli fizici). */
  area(): { x: number; y: number; w: number; h: number } {
    const { width, height } = this.scale;
    const top = 30 * DPR;
    if (this.mini) {
      const w = Math.round(width * 0.3);
      const h = Math.round((height - top) * 0.36);
      return { x: width - w - 6 * DPR, y: top + 6 * DPR, w, h };
    }
    return { x: 0, y: top, w: width, h: height - top };
  }

  /** Poziția pe ecran (pixeli CSS) a unui punct din arenă (în pătrățele). */
  toScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const m = (cam as unknown as { matrix: Phaser.GameObjects.Components.TransformMatrix }).matrix;
    const wx = x * this.T;
    const wy = y * this.T;
    // matricea camerei (include poziția viewport-ului): lume − scroll → ecran
    const sx = m.a * (wx - cam.scrollX) + m.c * (wy - cam.scrollY) + m.e;
    const sy = m.b * (wx - cam.scrollX) + m.d * (wy - cam.scrollY) + m.f;
    return { x: sx / DPR, y: sy / DPR };
  }

  /* ---------- evenimente → efecte ---------- */

  private onEvent(e: MatchEvent): void {
    const m = this.match;
    if (!m) return;
    const me = m.me;
    switch (e.type) {
      case 'explode': {
        const [hx, hy] = [me.px / U, me.py / U];
        if (me.alive) {
          const d = Math.hypot(hx - e.x, hy - e.y);
          this.shake = Math.min(1.6, this.shake + Math.max(0.12, 1.15 - d / 5) * (0.7 + e.range * 0.12));
        } else this.shake = Math.min(1.6, this.shake + 0.25);
        break;
      }
      case 'boxDestroyed':
        this.debris(e.x, e.y);
        if (e.cursed) this.sparkle(e.x, e.y, 0xb04fff);
        if (e.gold) this.sparkle(e.x, e.y, 0xffd23f);
        break;
      case 'boxSpawn':
        this.popIn.set(e.y * m.s.W + e.x, 0);
        this.sparkle(e.x, e.y, 0xffffff);
        break;
      case 'teleport':
        this.sparkle(e.x, e.y, hexNum(this.theme.portal));
        break;
      case 'portalOpen':
        for (const [x, y] of e.pads) this.sparkle(x, y, hexNum(this.theme.portal));
        break;
      case 'shieldSaved': {
        const p = m.s.players[e.player]!;
        this.sparkle(Math.round(p.px / U), Math.round(p.py / U), 0x4fd8ff);
        break;
      }
      case 'spiderDie':
        this.sparkle(e.x, e.y, 0x7a2bff);
        break;
      case 'strike':
        this.bolts.push({ x: e.x, y: e.y, t: 0.18, seed: Math.random() * 1e3 });
        this.flash = 0.7;
        this.shake = Math.min(1.6, this.shake + 0.5);
        break;
      case 'pushed':
      case 'respawn': {
        if (e.type === 'respawn') this.crushed.delete(e.player);
        const p = m.s.players[e.player]!;
        this.sparkle(
          Math.round(p.px / U),
          Math.round(p.py / U),
          e.type === 'respawn' ? hexNum(this.color(p)) : 0xffffff,
        );
        break;
      }
      case 'capture':
      case 'flagReturn':
        if ('player' in e && e.player !== null) {
          const p = m.s.players[e.player]!;
          if (e.type === 'capture') this.confetti(p.px / U, p.py / U);
          else this.sparkle(Math.round(p.px / U), Math.round(p.py / U), hexNum(TEAMS[e.team]!.color));
          if (e.type === 'capture') this.shake = Math.min(1.6, this.shake + 0.4);
        }
        break;
      case 'hero':
        if (e.hero.kind === 'win' || e.hero.kind === 'team') {
          const p = m.s.players[e.hero.player]!;
          this.confetti(p.px / U, p.py / U);
        }
        break;
      case 'missionHit':
        if (e.kind === 'tower') {
          this.hitT.set(`${e.x},${e.y}`, 0.3);
          this.shake = Math.min(1.6, this.shake + 0.4);
          if (e.done) {
            this.debris(e.x, e.y);
            this.debris(e.x, e.y);
            this.sparkle(e.x, e.y, 0xff5a4d);
          } else this.sparkle(e.x, e.y, 0xffffff);
        } else this.sparkle(e.x, e.y, e.kind === 'cage' ? 0x7dffb0 : 0x6ff4ff);
        break;
      case 'friendHome':
        this.sparkle(HOME[0], HOME[1], 0x7dffb0);
        break;
      case 'hurt':
        this.hurtT = 0.5;
        this.shake = Math.min(1.6, this.shake + 0.6);
        break;
      case 'death':
        if (e.cause === 'crush') {
          this.crushed.add(e.player);
          this.shake = Math.min(1.6, this.shake + 0.6);
        }
        break;
    }
  }

  private sparkle(x: number, y: number, c: number): void {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.28;
      const s = 2 + Math.random() * 3;
      this.particles.push({
        x: x + 0.5,
        y: y + 0.5,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5,
        c,
        s: 0.08,
        g: 0,
      });
    }
  }

  private debris(x: number, y: number): void {
    const c = this.theme.debris.map(hexNum);
    for (let i = 0; i < 7; i++)
      this.particles.push({
        x: x + 0.5,
        y: y + 0.5,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 6 - 1,
        life: 0.7 + Math.random() * 0.3,
        c: c[i % 2]!,
        s: 0.08 + Math.random() * 0.1,
        g: 18,
      });
  }

  private confetti(x: number, y: number): void {
    const cols = [0xffd23f, 0xff5f93, 0x4fc3ff, 0x7dffb0, 0xff8a3d, 0xffffff];
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 4 + Math.random() * 6;
      this.particles.push({
        x: x + 0.5,
        y: y + 0.2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1.3 + Math.random() * 0.8,
        c: cols[i % cols.length]!,
        s: 0.07 + Math.random() * 0.06,
        g: 9,
      });
    }
  }

  /* ---------- bucla ---------- */

  override update(_time: number, _delta: number): void {
    const raw = this.game.loop.rawDelta;
    this.fpsAcc += raw;
    this.fpsN++;
    if (this.fpsAcc >= 500) {
      this.fps = (this.fpsN * 1000) / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    this.onFrame?.(raw);
    const m = this.match;
    const cam = this.cameras.main;
    if (!m) {
      for (const p of Object.values(this.pools)) {
        p.begin();
        p.end();
      }
      this.g.clear();
      if (this.staticImg) this.staticImg.setVisible(false);
      cam.setBackgroundColor(this.theme ? this.theme.ink : '#141726');
      return;
    }
    const dt = Math.min(0.05, raw / 1000) * (m.paused ? 0 : 1);
    this.layout(m);
    this.draw(m, dt);
  }

  private color(p: Player): string {
    const c = this.match!.slots[p.id]?.color ?? '#ffffff';
    return this.theme.tint[c] ?? c;
  }

  private layout(m: Match): void {
    const s = m.s;
    const a = this.area();
    const cam = this.cameras.main;
    cam.setViewport(a.x, a.y, a.w, a.h);
    const inf = s.inf !== null;
    const T = inf
      ? Math.floor(
          this.mini
            ? Math.max(4, Math.min(a.w / 15, a.h / 11))
            : Math.max(18 * DPR, a.w >= a.h ? a.h / 12 : a.w / 11),
        )
      : Math.max(this.mini ? 4 : 12, Math.floor(Math.min(a.w / s.W, a.h / s.H)));
    if (T !== this.T || this.tex.T !== T || this.staticKey === '') {
      this.T = T;
      this.tex.reset(this.theme.id, T);
    }
    const skey = `${this.theme.id}@${T}`;
    if (inf) {
      this.staticImg?.setVisible(false);
      this.staticHard = null;
      this.staticKey = skey;
    } else if (this.staticKey !== skey || this.staticFor !== s) this.buildStatic(s);
    cam.setBackgroundColor(this.theme.ink);
    // arena rotativă: încape la orice unghi
    const rot = s.rot && !this.mini ? (s.rot.a / DEG) * (Math.PI / 180) : 0;
    const bw = s.W * T;
    const bh = s.H * T;
    this.rotK = rot
      ? Math.min(
          1,
          a.w / (bw * Math.abs(Math.cos(rot)) + bh * Math.abs(Math.sin(rot))),
          a.h / (bw * Math.abs(Math.sin(rot)) + bh * Math.abs(Math.cos(rot))),
        )
      : 1;
    // zoom cinematic („bye bye” 2.4×, momente de glorie 2.1×)
    const heroP = m.hero ? s.players[m.hero.player] : undefined;
    const focusP = m.doom ? m.me : heroP;
    const want = this.mini || !this.motion ? 1 : m.doom ? 2.4 : m.hero ? 2.1 : 1;
    this.zoomK += (want - this.zoomK) * 0.12;
    if (Math.abs(this.zoomK - 1) < 0.002) this.zoomK = 1;
    let cx = bw / 2;
    let cy = bh / 2;
    if (inf) {
      // camera urmărește lin jucătorul (tu ești mereu în centru)
      const me = m.me;
      if (me.alive || s.tick - me.deathTick < 2) {
        const [px, py] = m.lerp('p0', me.px, me.py);
        const k = Math.min(1, (this.game.loop.rawDelta / 1000) * 10);
        this.camX += (px - this.camX) * k;
        this.camY += (py - this.camY) * k;
      }
      cx = (this.camX + 0.5) * T;
      cy = (this.camY + 0.5) * T;
    }
    if (this.zoomK > 1 && focusP) {
      const [px, py] = m.lerp(`p${focusP.id}`, focusP.px, focusP.py);
      const k = Math.min(1, (this.zoomK - 1) / 1.4);
      cx += ((px + 0.5) * T - cx) * k;
      cy += ((py + 0.5) * T - cy) * k;
    }
    cam.setZoom(this.zoomK * this.rotK);
    let rj = 0;
    if (this.shake > 0.01 && this.motion && !this.mini) {
      const amp = this.shake * this.shake * 14 * DPR;
      cx += ((Math.random() - 0.5) * amp) / cam.zoom;
      cy += ((Math.random() - 0.5) * amp) / cam.zoom;
      rj = (((Math.random() - 0.5) * this.shake * 1.2) / 180) * Math.PI;
    }
    cam.setRotation(rot + rj);
    cam.centerOn(cx, cy);
    if (inf) {
      const hw = a.w / (2 * T * cam.zoom) + 2;
      const hh = a.h / (2 * T * cam.zoom) + 2;
      const vx = cx / T;
      const vy = cy / T;
      this.view = {
        x0: Math.floor(vx - hw),
        x1: Math.ceil(vx + hw),
        y0: Math.floor(vy - hh),
        y1: Math.ceil(vy + hh),
      };
    } else this.view = { x0: 0, x1: s.W - 1, y0: 0, y1: s.H - 1 };
    // amețeala (valuri + culori)
    const amt = m.me.alive && m.me.dizzyT > 0 ? Math.min(1, m.me.dizzyT / 30) : 0;
    if (
      amt > 0 &&
      this.motion &&
      !this.mini &&
      this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer
    ) {
      if (!this.dizzy) {
        cam.setPostPipeline('DizzyFX');
        this.dizzy = cam.getPostPipeline('DizzyFX') as DizzyFX;
      }
      this.dizzy.amt = amt;
      this.dizzy.t = m.time;
      this.dizzy.rows = a.h / (T * cam.zoom);
      this.dizzy.shift = (amt * T * cam.zoom * 0.35) / a.w;
    } else if (this.dizzy) {
      cam.resetPostPipeline();
      this.dizzy = null;
    }
  }

  private buildStatic(s: GameState): void {
    const T = this.T;
    const key = `static-${this.theme.id}-${T}-${Math.random().toString(36).slice(2, 7)}`;
    const old = this.staticImg?.texture.key;
    const tex = this.textures.createCanvas(key, s.W * T, s.H * T)!;
    const c = tex.getContext();
    const st = this.theme.style;
    this.staticHard = new Uint8Array(s.W * s.H);
    paint.withCtx(c, T, () => {
      for (let y = 0; y < s.H; y++)
        for (let x = 0; x < s.W; x++) {
          paint.ground(st, x, y, x * T, y * T);
          if (s.grid[y * s.W + x] === HARD) {
            paint.hard(st, x, y, x * T, y * T);
            this.staticHard![y * s.W + x] = 1;
          }
        }
    });
    tex.refresh();
    if (this.staticImg) this.staticImg.setTexture(key);
    else this.staticImg = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.static);
    this.staticImg.setVisible(true);
    if (old && old !== key) this.textures.remove(old);
    this.staticKey = `${this.theme.id}@${T}`;
    this.staticFor = s;
  }

  /* ---------- texturi ---------- */

  private t(name: string, w: number, h: number, ox: number, oy: number, draw: () => void) {
    return this.tex.get(name, w, h, ox, oy, draw);
  }

  private softTex(x: number, y: number) {
    const st = this.theme.style;
    const v = Math.floor(paint.hash(x, y, 21) * 6);
    return this.t(`soft${v}`, 1, 1, 0, 0, () => paint.soft(st, 7 + v * 3, 5 + v * 7, 0, 0));
  }

  private groundTex(x: number, y: number) {
    const st = this.theme.style;
    const par = (x + y) & 1;
    const v = Math.floor(paint.hash(x, y, 25) * 4);
    return this.t(`g${par}${v}`, 1, 1, 0, 0, () => paint.ground(st, 10 + v * 2 + par, 10, 0, 0));
  }

  private hardTex(x: number, y: number) {
    const st = this.theme.style;
    const v = Math.floor(paint.hash(x, y, 23) * 4);
    return this.t(`hard${v}`, 1, 1, 0, 0, () => paint.hard(st, 5 + v * 3, 5 + v * 5, 0, 0));
  }

  private bombTex(hot: boolean, team: number | null) {
    const st = this.theme.style;
    const tcol = team === null ? null : TEAMS[team]!.bomb;
    return this.t(`bomb${hot ? 1 : 0}${team ?? ''}`, 1.4, 1.6, 0.7, 0.95, () =>
      paint.bomb(st, 0, 0, hot, tcol),
    );
  }

  private charTex(p: Player, face: [number, number], expr: paint.Expr) {
    const st = this.theme.style;
    const col = this.color(p);
    return this.t(`ch${col}${face.join()}${expr}`, 1.8, 2.2, 0.9, 1.45, () =>
      paint.character(st, col, face, expr),
    );
  }

  /* ---------- desen ---------- */

  private draw(m: Match, dt: number): void {
    const s = m.s;
    const T = this.T;
    const time = m.time;
    const th = this.theme;
    const st = th.style;
    const P = this.pools;
    for (const p of Object.values(P)) p.begin();
    const g = this.g;
    g.clear();
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.flash = Math.max(0, this.flash - dt * 3);

    // rândul care alunecă (animat între pași)
    const sh = s.shift && s.shift.warn <= 0 && s.shift.stepT < SHIFT_STEP - 1 ? s.shift : null;
    const shProg = sh ? Math.min(1, (sh.stepT + m.alpha) / (SHIFT_STEP - 1)) : 1;
    const onSh = (x: number, y: number) =>
      sh !== null &&
      (sh.axis === 0 ? y === sh.idx && x > 0 && x < s.W - 1 : x === sh.idx && y > 0 && y < s.H - 1);
    const shOff = sh ? (1 - shProg) * -sh.dir * T : 0;

    const inf = s.inf !== null;
    const V = this.view;
    for (let y = V.y0; y <= V.y1; y++)
      for (let x = V.x0; x <= V.x1; x++) {
        if (inf && !inBounds(s, x, y)) continue;
        const k = idx(s, x, y);
        const gv = s.grid[k];
        let px = x * T;
        let py = y * T;
        if (inf) P.ground!.get(this.groundTex(x, y), px, py);
        const tgt = s.mission && gv === SOFT ? targetAt(s, x, y) : undefined;
        if (tgt && (tgt.type === 'tower' || tgt.type === 'cage')) {
          this.drawTarget(m, tgt, px, py, time);
          continue;
        }
        if (onSh(x, y)) {
          if (sh!.axis === 0) px += shOff;
          else py += shOff;
        }
        if (gv === HARD && !this.staticHard?.[k]) P.tiles!.get(this.hardTex(x, y), px, py);
        else if (gv === SOFT) {
          const pk = this.popIn.get(k);
          const im = P.tiles!.get(this.softTex(x, y), px, py);
          if (pk !== undefined) {
            const e = Math.min(1, pk / 0.35);
            const sc = Math.max(0.05, e < 1 ? e * (1 + 0.35 * Math.sin(e * Math.PI)) : 1);
            im.setOrigin(0.5)
              .setPosition(px + T / 2, py + T / 2)
              .setScale(sc);
            if (pk > 0.35) this.popIn.delete(k);
            else this.popIn.set(k, pk + dt);
          }
          if (s.gold[k]) {
            const o = P.over!.get(
              this.t('gold', 1, 1, 0, 0, () => paint.goldOverlay(0, 0, th.round)),
              px,
              py,
            );
            o.setAlpha(0.85 + 0.15 * Math.sin(time * 6 + x));
          } else if (s.cursed[k]) {
            const o = P.over!.get(
              this.t('curse', 1, 1, 0, 0, () => paint.curseOverlay(0, 0, th.round)),
              px,
              py,
            );
            o.setAlpha(0.8 + 0.2 * Math.sin(time * 3 + x + y));
          }
        } else {
          const it = s.items[k];
          if (it) this.drawItem(it, px, py, time);
        }
      }

    // rândul mobil: dungă roșie și săgeți
    if (s.shift) {
      const a = s.shift.warn > 0 ? 0.45 + 0.45 * Math.abs(Math.sin(time * 14)) : 0.35;
      g.fillStyle(0xff3c3c, a * 0.22);
      for (const [x, y] of shiftCells(s, s.shift)) g.fillRect(x * T, y * T, T, T);
      g.fillStyle(0xff463c, a);
      const d = s.shift.dir;
      const arrow = (x: number, y: number) => {
        const cx = (x + 0.5) * T;
        const cy = (y + 0.5) * T;
        if (s.shift!.axis === 0)
          g.fillTriangle(
            cx + d * T * 0.3,
            cy,
            cx - d * T * 0.2,
            cy - T * 0.3,
            cx - d * T * 0.2,
            cy + T * 0.3,
          );
        else
          g.fillTriangle(
            cx,
            cy + d * T * 0.3,
            cx - T * 0.3,
            cy - d * T * 0.2,
            cx + T * 0.3,
            cy - d * T * 0.2,
          );
      };
      if (s.shift.axis === 0) {
        arrow(d > 0 ? 0 : s.W - 1, s.shift.idx);
        arrow(d > 0 ? s.W - 1 : 0, s.shift.idx);
      } else {
        arrow(s.shift.idx, d > 0 ? 0 : s.H - 1);
        arrow(s.shift.idx, d > 0 ? s.H - 1 : 0);
      }
    }

    // portaluri (clipesc în ultimele 2.5s)
    if (s.pads.length && !(s.portalT < 2.5 * TICK_HZ && Math.sin(time * 18) > 0)) {
      const outer = this.t('padO', 1, 1, 0.5, 0.5, () => paint.portalRing(th.portal, false));
      const inner = this.t('padI', 1, 1, 0.5, 0.5, () => paint.portalRing(th.portal, true));
      const glowT = this.t('padG', 1, 1, 0.5, 0.5, () => paint.disc(th.portal, 0.3));
      for (const [x, y] of s.pads) {
        const cx = (x + 0.5) * T;
        const cy = (y + 0.5) * T;
        P.fx!.get(glowT, cx, cy).setAlpha(0.25 + 0.15 * Math.sin(time * 4));
        P.fx!.get(outer, cx, cy).setRotation(time * 2);
        P.fx!.get(inner, cx, cy).setRotation(-time * 3);
      }
    }

    // zonele de fulger anunțate (cruce galbenă care clipește)
    for (const c of s.clouds) {
      if (c.charge < 0) continue;
      const a = 0.35 + 0.35 * Math.abs(Math.sin(time * 16));
      const z = this.t('zone', 1, 1, 0, 0, () => paint.roundTile('rgba(255,236,80,.45)', '#ffec50', true));
      for (const [dx, dy] of [[0, 0], ...FACE] as [number, number][]) {
        const x = c.sx + dx;
        const y = c.sy + dy;
        if (x < 0 || y < 0 || x >= s.W || y >= s.H || s.grid[y * s.W + x] === HARD) continue;
        P.fx!.get(z, x * T, y * T).setAlpha(a * 1.6);
      }
    }

    // bombe de pe jos
    for (const b of s.bombs) {
      if (b.held !== null || b.fly) continue;
      this.drawBomb(m, b, time, P.bombs!);
    }

    // flăcări
    const fl = this.t('flame', 1, 1, 0, 0, () => paint.flame(th.flame, th.round, st === 'neon'));
    for (let k = 0; k < s.flame.length; k++) {
      const f = s.flame[k]!;
      if (f <= 0) continue;
      const fx = inf ? s.inf!.ownX[k]! : k % s.W;
      const fy = inf ? s.inf!.ownY[k]! : Math.floor(k / s.W);
      P.flames!.get(fl, fx * T, fy * T).setAlpha(Math.min(1, f / (0.2 * TICK_HZ)));
    }

    // capturează steagul: baze și steaguri
    if (s.ctf) this.drawCtf(m, time);
    if (s.mission) this.drawMission(m, time, dt);

    // păianjeni
    for (const c of s.spiders) {
      const [x, y] = m.lerp(`s${c.id}`, c.px, c.py);
      const frame = Math.floor(time * 9 + c.id) % 2;
      const im = P.actors!.get(
        this.t(`spider${frame}`, 0.8, 0.8, 0.4, 0.4, () => paint.spider(frame)),
        (x + 0.5) * T,
        (y + 0.5) * T,
      );
      im.setRotation(Math.atan2(FACE[c.dir]![1], FACE[c.dir]![0]) + Math.PI / 2).setDepth(
        DEPTH.actors + y * 0.01,
      );
    }

    // jucători, sortați după y
    const order = s.players.slice().sort((a, b) => a.py - b.py);
    for (const p of order) this.drawPlayer(m, p, time, dt);

    // nori
    for (const c of s.clouds) {
      const [x, y] = m.lerp(`c${c.id}`, c.px, c.py);
      const cx = (x + 0.5) * T;
      const cy = (y + 0.5) * T;
      const born = Math.min(1, (280 - c.life) / 8 + 0.2);
      const fade = c.life < 12 ? c.life / 12 : 1;
      const sha = P.clouds!.get(
        this.t('shadow', 1, 0.4, 0.5, 0.2, () => paint.disc('rgba(10,13,24,1)', 0.42)),
        cx,
        cy + T * 0.1,
      );
      sha.setScale(1, 0.38).setAlpha(0.35 * born * fade);
      const mode: 0 | 1 | 2 = c.charge >= 0 ? (Math.sin(time * 25) > 0.3 ? 2 : 1) : 0;
      const im = P.clouds!.get(
        this.t(`cloud${mode}`, 1.2, 1, 0.6, 0.5, () => paint.cloud(mode)),
        cx,
        cy - T * 0.95 + Math.sin(time * 2 + c.id) * T * 0.05,
      );
      im.setAlpha(born * fade);
    }

    // bombe în zbor (deasupra tuturor)
    for (const b of s.bombs) if (b.fly) this.drawBomb(m, b, time, P.fly!);

    // fulgere
    for (const b of this.bolts) {
      b.t -= dt;
      const px = (b.x + 0.5) * T;
      const py = (b.y + 0.5) * T;
      let yy = py - T * 1.1;
      let xx = px;
      let sd = b.seed;
      const pts: [number, number][] = [[xx, yy]];
      while (yy < py) {
        sd = (sd * 9301 + 49297) % 233280;
        yy += T * 0.25;
        xx = px + (sd / 233280 - 0.5) * T * 0.5;
        pts.push([xx, Math.min(yy, py)]);
      }
      for (const [w, c, a] of [
        [T * 0.22, 0x9fd3ff, 0.35],
        [T * 0.1, 0xfffbe0, 1],
        [T * 0.035, 0xffffff, 1],
      ] as const) {
        g.lineStyle(w, c, a);
        g.beginPath();
        g.moveTo(pts[0]![0], pts[0]![1]);
        for (const [x2, y2] of pts.slice(1)) g.lineTo(x2, y2);
        g.strokePath();
      }
    }
    this.bolts = this.bolts.filter((b) => b.t > 0);

    // particule
    const dot = this.t('dot', 0.25, 0.25, 0.125, 0.125, () => paint.disc('#ffffff', 0.12));
    for (const q of this.particles) {
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (q.life <= 0) continue;
      const im = P.parts!.get(dot, q.x * T, q.y * T);
      im.setTint(q.c)
        .setAlpha(Math.min(1, q.life * 2))
        .setScale(q.s * 4);
    }
    this.particles = this.particles.filter((q) => q.life > 0);

    // ambient de temă
    if (th.ambient && !this.mini) {
      const w = (V.x1 - V.x0 + 1) * T;
      const h = (V.y1 - V.y0 + 1) * T;
      const amb = this.t('amb', 0.8, 0.5, 0.4, 0.25, () => paint.ambient(st));
      const md = (a: number, n: number) => ((a % n) + n) % n;
      for (let i = 0; i < th.ambient; i++) {
        const a = paint.hash(i, 0, 31);
        const b = paint.hash(i, 1, 31);
        const c = paint.hash(i, 2, 31);
        let x: number;
        let y: number;
        let sc = 1;
        let alpha = 0.85;
        if (st === 'xmas') {
          x = md(a * w + Math.sin(time * 0.8 + i) * T * 0.5, w);
          y = md(b * h + time * T * (0.5 + c * 0.6), h);
          sc = 0.5 + c * 0.8;
        } else if (st === 'valentine') {
          x = md(a * w + Math.sin(time * 0.7 + i) * T * 0.6, w);
          y = md(b * h - time * T * (0.35 + c * 0.3), h);
          sc = 0.7 + c * 0.7;
          alpha = 0.45;
        } else if (st === 'halloween') {
          x = md(a * w + time * T * (1.2 + c), w + T * 2) - T;
          y = b * h * 0.8 + Math.sin(time * 2 + i) * T * 0.4;
          sc = 1;
          alpha = 0.85;
        } else {
          x = md(a * w + time * T * (1.6 + c), w + T * 2) - T;
          y = md(b * h + time * T * (0.5 + c * 0.4), h + T * 2) - T;
          alpha = 0.9;
        }
        const im = P.amb!.get(amb, x + V.x0 * T, y + V.y0 * T)
          .setScale(sc)
          .setAlpha(alpha);
        if (st === 'halloween') im.setScale(sc, sc * (0.7 + 0.3 * Math.abs(Math.sin(time * 18 + i))));
      }
      if (st === 'halloween') {
        g.fillStyle(0x3c145a, 0.12);
        g.fillRect(V.x0 * T, V.y0 * T, w, h);
      }
    }

    // fulger: ecranul se luminează
    const VW = (V.x1 - V.x0 + 1) * T;
    const VH = (V.y1 - V.y0 + 1) * T;
    if (this.flash > 0) {
      g.fillStyle(0xe6f0ff, 0.22 * this.flash);
      g.fillRect(V.x0 * T, V.y0 * T, VW, VH);
    }
    // rănit: flash roșu
    if (this.hurtT > 0) {
      this.hurtT = Math.max(0, this.hurtT - dt);
      g.fillStyle(0xff2828, this.hurtT * 0.5);
      g.fillRect(V.x0 * T, V.y0 * T, VW, VH);
    }

    for (const p of Object.values(P)) p.end();
    for (const tx of this.texts) if (!tx.getData('used')) tx.setVisible(false);
    for (const tx of this.texts) tx.setData('used', false);
  }

  private drawItem(it: ItemType, px: number, py: number, time: number): void {
    const T = this.T;
    const im = this.pools.items!.get(
      this.t(`it-${it}`, 1, 1, 0.5, 0.5, () => paint.item(it, -T / 2, -T / 2, this.theme.round)),
      px + T / 2,
      py + T / 2 + Math.sin(time * 4 + px / T) * T * 0.04,
    );
    if (isGold(it)) im.setScale(1 + 0.04 * Math.sin(time * 6));
  }

  private drawBomb(m: Match, b: GameState['bombs'][number], time: number, pool: Pool): void {
    const T = this.T;
    const s = m.s;
    const pos = m.bombPos(b);
    const lift = pos.lift * T * 1.1;
    const cx = (pos.x + 0.5) * T;
    const cy = (pos.y + 0.5) * T;
    const hotPhase = b.fuse < 16;
    const rate = hotPhase ? 22 : 10;
    const pul = 1 + Math.sin(time * rate) * 0.07;
    const hot = hotPhase && Math.sin(time * rate) > 0;
    const owner = s.players[b.owner];
    const team = m.team && owner ? owner.team : null;
    const sha = pool.get(
      this.t('shadow', 1, 0.4, 0.5, 0.2, () => paint.disc('rgba(0,0,0,1)', 0.42)),
      cx,
      cy + T * 0.3,
    );
    sha.setScale(0.66 * (1 - lift / (T * 2)), 0.26).setAlpha(0.25);
    if (team !== null) {
      const r = pool.get(
        this.t(`tring${team}`, 1, 0.4, 0.5, 0.2, () => paint.ring(TEAMS[team]!.color, 0.36, 0.12, 0.05)),
        cx,
        cy + T * 0.3,
      );
      r.setAlpha(0.8);
    }
    const by = cy + T * 0.03 - lift;
    pool.get(this.bombTex(hot, team), cx, by).setScale(pul);
    const so = paint.sparkOffset(this.theme.style);
    if (so) {
      const sp = pool.get(
        this.t('spark', 0.3, 0.3, 0.15, 0.15, () => paint.disc('#ffffff', 0.09)),
        cx + so[0] * T * pul,
        by + so[1] * T * pul,
      );
      sp.setTint(Math.random() < 0.5 ? 0xffd23f : 0xff7a1a).setScale(0.6 + Math.random() * 0.5);
    }
    if (b.remote) {
      pool.get(
        this.t('ant', 0.6, 0.6, 0.3, 0.3, () => paint.antenna(0, 0)),
        cx,
        by,
      );
      const led = pool.get(
        this.t('led', 0.2, 0.2, 0.1, 0.1, () => paint.disc('#ffffff', 0.055)),
        cx - T * 0.2,
        by - T * 0.42,
      );
      led.setTint(Math.sin(time * 9) > 0 ? 0xff3b3b : 0x5a0f0f);
    }
  }

  private drawCtf(m: Match, time: number): void {
    const s = m.s;
    const T = this.T;
    const P = this.pools;
    for (const f of s.ctf!.flags) {
      const col = TEAMS[f.team]!.color;
      const base = P.fx!.get(
        this.t(`base${f.team}`, 1.5, 0.8, 0.75, 0.4, () => {
          paint.disc(col + '2e', 0.5);
          paint.ring(col, 0.62, 0.3, 0.07);
        }),
        (f.hx + 0.5) * T,
        (f.hy + 0.62) * T,
      );
      base.setScale(1, 0.55).setAlpha(0.6 + 0.25 * Math.sin(time * 3));
      if (f.carrier !== null) continue;
      const im = P.ctf!.get(
        this.t(`flag${f.team}`, 0.6, 0.9, 0.1, 0.8, () => paint.flag(col)),
        (f.x + 0.5) * T,
        (f.y + 0.5) * T,
      );
      im.setDepth(DEPTH.actors + f.y * 0.01 + 0.005);
      if (!f.atHome) {
        im.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(time * 6)));
        this.label(String(Math.ceil(f.dropT / TICK_HZ)), (f.x + 0.5) * T, (f.y + 0.95) * T);
      }
    }
  }

  /** Turn sau cușcă (în locul lăzii). */
  private drawTarget(
    m: Match,
    t: NonNullable<ReturnType<typeof targetAt>>,
    px: number,
    py: number,
    time: number,
  ): void {
    const T = this.T;
    const k = `${t.x},${t.y}`;
    if (t.type === 'tower') {
      const h = this.hitT.get(k) ?? 0;
      const im = this.pools.actors!.get(
        this.t(`tower${t.hp}${t.maxHp}`, 1, 1.8, 0, 0.8, () => paint.tower(t.hp, t.maxHp)),
        px + (h > 0 ? Math.sin(time * 80) * T * 0.04 : 0),
        py,
      );
      im.setDepth(DEPTH.actors + t.y * 0.01 - 0.002);
      return;
    }
    const col = FRIEND_COL[m.s.mission!.targets.indexOf(t) % FRIEND_COL.length]!;
    this.pools.tiles!.get(
      this.t(`cage${col}`, 1, 1, 0, 0, () => paint.cage(col)),
      px,
      py,
    );
    if (Math.sin(time * 2 + t.x) > 0.3) this.label('Help!', px + T / 2, py - T * 0.08);
  }

  private drawMission(m: Match, time: number, dt: number): void {
    const s = m.s;
    const T = this.T;
    const P = this.pools;
    const mi = s.mission!;
    for (const [k, v] of this.hitT)
      if (v - dt <= 0) this.hitT.delete(k);
      else this.hitT.set(k, v - dt);
    // casa (start)
    const home = P.fx!.get(
      this.t('home', 1.5, 0.8, 0.75, 0.4, () => paint.ring('#7dffb0', 0.62, 0.3, 0.06)),
      (HOME[0] + 0.5) * T,
      (HOME[1] + 0.55) * T,
    );
    home.setAlpha(0.6 + 0.3 * Math.sin(time * 3));
    if (mi.def.kind === 'rescue')
      P.ctf!.get(
        this.t('homeflag', 0.6, 0.9, 0.1, 0.8, () => paint.flag('#7dffb0')),
        (HOME[0] + 0.3) * T,
        (HOME[1] + 0.5) * T,
      ).setDepth(DEPTH.actors + HOME[1] * 0.01);
    // steagul cursei
    for (const t of mi.targets) {
      if (t.type !== 'flag' || t.done) continue;
      const glow = P.fx!.get(
        this.t('fglow', 1, 1, 0.5, 0.5, () => paint.disc('rgba(255,210,63,0.25)', 0.45)),
        (t.x + 0.5) * T,
        (t.y + 0.5) * T,
      );
      glow.setScale(1 + 0.18 * Math.sin(time * 4));
      P.ctf!.get(
        this.t('raceflag', 0.8, 1.5, 0.3, 1.3, () => paint.raceFlag()),
        (t.x + 0.5) * T,
        (t.y + 0.55) * T,
      ).setDepth(DEPTH.actors + t.y * 0.01);
    }
    // prietenii salvați
    for (const f of mi.friends) {
      if (f.home) continue;
      const [x, y] = m.lerp(`f${f.id}`, f.px, f.py);
      const col = FRIEND_COL[f.target % FRIEND_COL.length]!;
      const bob = f.moving ? Math.abs(Math.sin(time * 14)) * T * 0.05 : 0;
      const faint = f.faint > 0;
      const dir: [number, number] = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ][f.dir] as [number, number];
      P.actors!.get(
        this.t('shadow', 1, 0.4, 0.5, 0.2, () => paint.disc('rgba(0,0,0,1)', 0.42)),
        (x + 0.5) * T,
        (y + 0.5) * T + T * 0.3,
      )
        .setScale(0.48, 0.14)
        .setAlpha(0.25);
      const im = P.actors!.get(
        this.t(`friend${col}${faint ? 'x' : dir.join()}`, 0.7, 0.7, 0.35, 0.35, () =>
          paint.friendFace(col, 0, 0, faint, dir),
        ),
        (x + 0.5) * T,
        (y + 0.5) * T - bob,
      );
      im.setDepth(DEPTH.actors + y * 0.01);
      if (faint) {
        const star = this.t('star', 0.2, 0.2, 0.1, 0.1, () => paint.ring('#ffe14a', 0.05, 0.05, 0.035));
        for (let i = 0; i < 3; i++) {
          const a = time * 5 + i * 2.1;
          P.actors!.get(star, (x + 0.5) * T + Math.cos(a) * T * 0.2, (y + 0.5) * T - T * 0.35).setDepth(
            DEPTH.actors + y * 0.01 + 0.001,
          );
        }
      }
    }
  }

  private label(text: string, x: number, y: number): void {
    let tx = this.texts.find((t) => !t.getData('used'));
    if (!tx) {
      tx = this.add
        .text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontStyle: '800', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(DEPTH.top + 3);
      this.texts.push(tx);
    }
    tx.setData('used', true)
      .setVisible(true)
      .setText(text)
      .setPosition(x, y)
      .setFontSize(Math.round(this.T * 0.22));
  }

  private drawPlayer(m: Match, p: Player, time: number, dt: number): void {
    const s = m.s;
    const T = this.T;
    const P = this.pools;
    const deadT = p.alive ? 0 : (s.tick - p.deathTick) / TICK_HZ + m.alpha / TICK_HZ;
    const crushed = !p.alive && this.crushed.has(p.id);
    if (!p.alive && deadT > (crushed ? 1.6 : 1.4)) return;
    const [x, y] = m.lerp(`p${p.id}`, p.px, p.py);
    const depth = DEPTH.actors + y * 0.01;
    const hero = m.hero && m.hero.player === p.id && p.alive ? m.hero : null;
    const isMe = p.id === 0;
    const doom = isMe && m.doom;
    let w = this.walk.get(p.id) ?? p.id * 1.7;
    if (p.moving) w += dt * ((p.speed * TICK_HZ) / U) * 5;
    if (hero?.kind === 'speed') w += dt * 30;
    this.walk.set(p.id, w);
    const ph = p.moving || hero?.kind === 'speed' ? Math.sin(w) : 0;
    const bob = p.moving ? Math.abs(Math.sin(w)) * -T * 0.04 : Math.sin(time * 3 + p.id) * T * 0.012;
    let cx = (x + 0.5) * T;
    let cy = (y + 0.5) * T;
    let rot = 0;
    let sx = 1;
    let sy = 1;
    let alpha = 1;
    if (hero) {
      if (hero.kind === 'speed') cx += Math.sin(hero.t * 50) * T * 0.03;
      if (hero.kind === 'win' || hero.kind === 'team') {
        cy -= Math.abs(Math.sin(hero.t * 7)) * T * 0.45;
        rot = Math.sin(hero.t * 14) * 0.18;
      }
    }
    if (!p.alive) {
      if (crushed) {
        cy += T * 0.25;
        sx = 1.6;
        sy = 0.22;
        alpha = Math.max(0, 1 - deadT / 1.6);
      } else {
        cy -= deadT * T * 0.9;
        rot = deadT * 9;
        const k = Math.max(0.05, 1 - deadT * 0.55);
        sx = sy = k;
        alpha = Math.max(0, 1 - deadT / 1.4);
      }
    }
    const col = this.color(p);
    // umbra
    if (p.alive) {
      const sha = P.actors!.get(
        this.t('shadow', 1, 0.4, 0.5, 0.2, () => paint.disc('rgba(0,0,0,1)', 0.42)),
        cx,
        (y + 0.5) * T + T * 0.36,
      );
      sha
        .setScale(0.62, 0.17)
        .setAlpha(0.25)
        .setDepth(depth - 0.001);
    }
    // inelul auriu + săgeata pentru jucătorul propriu; inel de echipă pentru coechipieri
    if (p.alive && isMe && !this.mini) {
      const pu = (Math.sin(time * 5) + 1) / 2;
      const r = P.actors!.get(
        this.t('halo', 1.2, 0.5, 0.6, 0.25, () => paint.ring('#ffe14a', 0.4, 0.14, 0.06, true)),
        cx,
        (y + 0.5) * T + T * 0.34,
      );
      r.setScale(0.9 + 0.15 * pu)
        .setAlpha(0.55 + 0.4 * pu)
        .setDepth(depth - 0.0005);
      P.actors!.get(
        this.t('arrow', 0.4, 0.3, 0.2, 0.15, () => paint.arrow()),
        cx,
        cy - T * (1.02 + 0.08 * Math.sin(time * 6)),
      ).setDepth(depth + 0.004);
    } else if (p.alive && m.team && p.team === m.me.team) {
      const r = P.actors!.get(
        this.t(`mate${p.team}`, 1, 0.4, 0.5, 0.2, () => paint.ring(TEAMS[p.team]!.color, 0.34, 0.1, 0.05)),
        cx,
        (y + 0.5) * T + T * 0.34,
      );
      r.setDepth(depth - 0.0005);
    }
    // aura de flăcări (rază maximă)
    if (hero?.kind === 'fire') {
      const fl = this.t('aura', 0.4, 0.6, 0.2, 0.3, () => {
        paint.disc(this.theme.flame[0], 0.14, true);
      });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + hero.t * 3;
        const r0 = T * (0.48 + 0.08 * Math.sin(hero.t * 14 + i));
        P.actors!.get(fl, cx + Math.cos(a) * r0 * 0.7, cy - T * 0.05 + Math.sin(a) * r0 * 0.6)
          .setRotation(a + Math.PI / 2)
          .setScale(1, 1.7)
          .setAlpha(0.6)
          .setDepth(depth - 0.0002);
      }
    }
    // linii de viteză
    if (hero?.kind === 'speed') {
      const [fx0, fy0] = FACE[p.face]!;
      const bx0 = -(fx0 || 1);
      const by0 = -fy0;
      this.g.lineStyle(T * 0.05, 0xffffff, 0.85);
      for (let i = 0; i < 4; i++) {
        const o = (i - 1.5) * T * 0.16;
        const ln = T * (0.5 + 0.3 * Math.abs(Math.sin(hero.t * 20 + i)));
        const st0 = T * 0.45;
        this.g.lineBetween(
          cx + bx0 * st0 - by0 * o,
          cy + by0 * st0 + bx0 * o - T * 0.05,
          cx + bx0 * (st0 + ln) - by0 * o,
          cy + by0 * (st0 + ln) + bx0 * o - T * 0.05,
        );
      }
    }
    // picioare
    if (this.theme.style !== 'pixel') {
      const ft = this.t(`foot${col}`, 0.4, 0.3, 0.2, 0.15, () => paint.foot(this.theme.style, col));
      for (const sd of [-1, 1]) {
        const f = P.actors!.get(
          ft,
          cx + sd * T * 0.34 * 0.45 * sx,
          cy + (T * 0.28 + sd * -ph * T * 0.04) * sy,
        );
        f.setScale(sx, sy)
          .setAlpha(alpha)
          .setRotation(rot * 0.3)
          .setDepth(depth);
      }
    }
    // corpul (cu fața spre direcția privirii; la „bye bye” se uită la bombă, apoi la tine)
    let face = FACE[p.face]!;
    let expr: paint.Expr = !p.alive ? 'dead' : hero ? 'happy' : doom ? 'doom' : 'normal';
    if (doom && p.alive) {
      const b = s.bombs.find((o) => o.id === m.doom!.bomb);
      if (m.doom!.t < 0.9 && b) {
        const dx = b.x - Math.round(x);
        const dy = b.y - Math.round(y);
        face = Math.abs(dx) >= Math.abs(dy) ? (dx ? [Math.sign(dx), 0] : [0, 1]) : [0, Math.sign(dy)];
      } else face = [0, 1];
    }
    if (!p.alive) expr = 'dead';
    const body = P.actors!.get(this.charTex(p, face, expr), cx, cy + bob * sy);
    body
      .setScale(sx, sy)
      .setRotation(rot)
      .setAlpha(alpha)
      .setDepth(depth + 0.001);
    if (!p.alive) return;
    // bomba ținută deasupra capului
    if (p.carry !== null) {
      const b = s.bombs.find((o) => o.id === p.carry);
      if (b)
        P.actors!.get(this.bombTex(false, m.team ? p.team : null), cx, cy - T * 0.72 + bob)
          .setScale(0.7)
          .setDepth(depth + 0.002);
    }
    // steagul pe spate
    const carried = s.ctf?.flags.find((f) => f.carrier === p.id);
    if (carried) {
      const fl = P.actors!.get(
        this.t(`flag${carried.team}`, 0.6, 0.9, 0.1, 0.8, () => paint.flag(TEAMS[carried.team]!.color)),
        cx - T * 0.28,
        cy + T * 0.1 + bob,
      );
      fl.setRotation(-0.15 + Math.sin(time * 10) * 0.05).setDepth(depth + 0.0008);
    }
    // jonglerie cu bombe (bombe maxime)
    if (hero?.kind === 'bombs') {
      const bt = this.bombTex(false, null);
      for (let i = 0; i < 6; i++) {
        const a = hero.t * 6 + (i / 6) * Math.PI * 2;
        P.actors!.get(
          bt,
          cx + Math.cos(a) * T * 0.62,
          cy - T * 0.15 + Math.sin(a) * T * 0.3 - Math.abs(Math.sin(a * 1.5)) * T * 0.2,
        )
          .setScale(0.34)
          .setDepth(depth + (Math.sin(a) > 0 ? 0.003 : -0.0003));
      }
    }
    // coroana la victorie
    if (hero && (hero.kind === 'win' || hero.kind === 'team')) {
      P.actors!.get(
        this.t('crown', 0.6, 0.4, 0.3, 0.35, () => paint.crown()),
        cx,
        cy - T * 0.62,
      )
        .setRotation(rot)
        .setDepth(depth + 0.003);
    }
    // scutul (clipește în ultimele 2s)
    if (p.shieldT > 0 && !(p.shieldT < 2 * TICK_HZ && Math.sin(time * 20) > 0)) {
      const sh = P.actors!.get(
        this.t('shield', 1.2, 1.2, 0.6, 0.6, () => {
          paint.disc('rgba(79,216,255,0.3)', 0.52);
          paint.ring('#bff3ff', 0.52, 0.52, 0.04);
        }),
        cx,
        cy - T * 0.02,
      );
      sh.setAlpha(0.85 + 0.3 * Math.sin(time * 6)).setDepth(depth + 0.004);
    }
    // amețit: steluțe
    if (p.dizzyT > 0) {
      const star = this.t('star', 0.2, 0.2, 0.1, 0.1, () => paint.ring('#ffe14a', 0.05, 0.05, 0.035));
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + i * 2.09;
        P.actors!.get(
          star,
          cx + Math.cos(a) * T * 0.22,
          cy - T * 0.52 + Math.sin(a) * T * 0.07 + bob,
        ).setDepth(depth + 0.004);
      }
    }
    // inversat / sughiț
    if (p.revT > 0 || p.hicT > 0) {
      const ch = p.revT > 0 ? '⇄' : '!';
      P.actors!.get(
        this.t(`badge${ch}`, 0.4, 0.4, 0.2, 0.2, () => paint.badge(ch)),
        cx + T * 0.3,
        cy - T * (p.bot !== null ? 0.72 : 1.3) + bob,
      ).setDepth(depth + 0.005);
    }
  }

  /** Jucători striviți de rândul mobil (animație turtită). */
  private crushed = new Set<number>();
}
