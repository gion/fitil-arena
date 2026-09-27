import Phaser from 'phaser';
import {
  EMPTY,
  HARD,
  SOFT,
  TICK_HZ,
  TICK_MS,
  U,
  collectInputs,
  createGame,
  gridForAspect,
  isGold,
  isNegative,
  step,
} from '@fitil/sim';
import type { BotLevel, GameState, ItemType } from '@fitil/sim';
import { Capacitor } from '@capacitor/core';
import { DPR } from './display.ts';
import { tapHaptic } from './haptics.ts';

const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'insane'];
const COLORS = [0x5ad15a, 0xf3f1ea, 0x9a6436, 0x2fd3c6];
const ITEM_COLOR: Record<string, number> = {
  bomb: 0x9fb4ff,
  fire: 0xff9a3c,
  speed: 0x7dffb0,
  kick: 0xffb347,
  glove: 0xff8ad8,
  remote: 0xff4d4d,
  line: 0xffe14a,
  shield: 0x4fd8ff,
};

/**
 * Vizualizare de verificare pentru Faza 1: un meci între 4 boți rulat de `@fitil/sim` la 20 Hz,
 * desenat cu forme simple și interpolat la 60 fps. Se înlocuiește cu randarea completă în Faza 2.
 */
export class ArenaScene extends Phaser.Scene {
  private s!: GameState;
  private prev = new Map<number, { x: number; y: number }>();
  private acc = 0;
  private endAt = 0;
  private g!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private matchNo = 0;

  constructor() {
    super('arena');
  }

  create(): void {
    this.g = this.add.graphics();
    this.label = this.add.text(12 * DPR, 8 * DPR, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${13 * DPR}px`,
      color: '#9ba1c6',
    });
    this.newMatch();
    this.input.on('pointerdown', () => {
      tapHaptic();
      this.newMatch();
    });
    this.scale.on('resize', () => this.newMatch());
  }

  private newMatch(): void {
    const { width, height } = this.scale;
    this.matchNo++;
    this.s = createGame({
      seed: (Math.random() * 2 ** 31) | 0,
      rules: gridForAspect(width / height),
      players: LEVELS.map((bot) => ({ bot })),
    });
    this.prev.clear();
    this.acc = 0;
    this.endAt = 0;
  }

  override update(): void {
    // timp real (nu delta netezit de Phaser), ca simularea să rămână la 20 Hz și când scad cadrele
    const delta = this.game.loop.rawDelta;
    const s = this.s;
    if (s.result && !this.endAt) this.endAt = this.time.now + 3000;
    if (this.endAt && this.time.now > this.endAt) this.newMatch();

    this.acc += Math.min(delta, 250);
    let steps = 0;
    while (this.acc >= TICK_MS && steps++ < 5) {
      this.acc -= TICK_MS;
      for (const p of s.players) this.prev.set(p.id, { x: p.px, y: p.py });
      step(s, collectInputs(s));
      if (s.events.some((e) => e.type === 'explode') && Capacitor.isNativePlatform()) tapHaptic();
    }
    this.draw(Math.min(1, this.acc / TICK_MS));
  }

  private draw(alpha: number): void {
    const s = this.s;
    const g = this.g;
    const { width, height } = this.scale;
    const top = 30 * DPR;
    const T = Math.floor(Math.min(width / s.W, (height - top) / s.H));
    const ox = Math.floor((width - T * s.W) / 2);
    const oy = top + Math.floor((height - top - T * s.H) / 2);
    g.clear();

    for (let y = 0; y < s.H; y++)
      for (let x = 0; x < s.W; x++) {
        const k = y * s.W + x;
        const px = ox + x * T;
        const py = oy + y * T;
        const t = s.grid[k];
        if (t === HARD) {
          g.fillStyle(0x3d4356).fillRect(px, py, T, T);
          g.fillStyle(0x646c85).fillRoundedRect(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.72, T * 0.12);
        } else {
          g.fillStyle((x + y) % 2 ? 0x5f9442 : 0x679d48).fillRect(px, py, T, T);
          if (t === SOFT) {
            g.fillStyle(0x8a5228).fillRoundedRect(px + T * 0.05, py + T * 0.05, T * 0.9, T * 0.9, T * 0.1);
            g.fillStyle(0xc8834a).fillRoundedRect(px + T * 0.11, py + T * 0.1, T * 0.78, T * 0.72, T * 0.07);
            if (s.gold[k])
              g.lineStyle(T * 0.07, 0xffd23f).strokeRoundedRect(
                px + T * 0.08,
                py + T * 0.08,
                T * 0.84,
                T * 0.84,
                T * 0.1,
              );
          } else if (t === EMPTY) {
            const it = s.items[k];
            if (it) this.drawItem(it, px, py, T);
          }
        }
        if (s.flame[k]! > 0) {
          const a = Math.min(1, s.flame[k]! / 4);
          g.fillStyle(0xff7a1a, a).fillRoundedRect(px + T * 0.04, py + T * 0.04, T * 0.92, T * 0.92, T * 0.3);
          g.fillStyle(0xffc93a, a).fillRoundedRect(
            px + T * 0.18,
            py + T * 0.18,
            T * 0.64,
            T * 0.64,
            T * 0.24,
          );
          g.fillStyle(0xfff6c4, a).fillRoundedRect(
            px + T * 0.32,
            py + T * 0.32,
            T * 0.36,
            T * 0.36,
            T * 0.18,
          );
        }
      }

    for (const [x, y] of s.pads) {
      g.lineStyle(T * 0.07, 0xb18cff).strokeCircle(ox + (x + 0.5) * T, oy + (y + 0.5) * T, T * 0.34);
    }

    for (const b of s.bombs) {
      if (b.held !== null) continue;
      let bx = b.x;
      let by = b.y;
      if (b.slide !== null) {
        bx += [0, 0, -1, 1][b.slide]! * (b.prog / U);
        by += [-1, 1, 0, 0][b.slide]! * (b.prog / U);
      }
      const pulse = 1 + Math.sin((s.tick + alpha) * (b.fuse < 16 ? 1.1 : 0.5)) * 0.07;
      const cx = ox + (bx + 0.5) * T;
      const cy = oy + (by + 0.5) * T;
      g.fillStyle(0x000000, 0.25).fillEllipse(cx, cy + T * 0.3, T * 0.56, T * 0.16);
      g.fillStyle(b.fuse < 16 && s.tick % 4 < 2 ? 0x5a1a1a : 0x15171f).fillCircle(cx, cy, T * 0.32 * pulse);
      g.fillStyle(0xffffff, 0.55).fillCircle(cx - T * 0.12, cy - T * 0.1, T * 0.06);
      g.fillStyle(0xffd23f).fillCircle(cx + T * 0.2, cy - T * 0.36, T * 0.06);
    }

    for (const p of s.players) {
      if (!p.alive && s.tick - p.deathTick > TICK_HZ) continue;
      const pr = this.prev.get(p.id) ?? { x: p.px, y: p.py };
      const x = (pr.x + (p.px - pr.x) * alpha) / U;
      const y = (pr.y + (p.py - pr.y) * alpha) / U;
      const cx = ox + (x + 0.5) * T;
      const cy = oy + (y + 0.5) * T;
      const fade = p.alive ? 1 : 1 - (s.tick - p.deathTick) / TICK_HZ;
      g.fillStyle(0x000000, 0.25 * fade).fillEllipse(cx, cy + T * 0.34, T * 0.52, T * 0.14);
      g.fillStyle(COLORS[p.id % COLORS.length]!, fade).fillCircle(cx, cy - T * 0.02, T * 0.34);
      g.lineStyle(Math.max(1, T * 0.05), 0x12131c, fade).strokeCircle(cx, cy - T * 0.02, T * 0.34);
      const fx = [0, 0, -1, 1][p.face]! * T * 0.09;
      const fy = [-1, 1, 0, 0][p.face]! * T * 0.06;
      for (const sd of [-1, 1]) {
        g.fillStyle(0xffffff, fade).fillEllipse(
          cx + sd * T * 0.12 + fx,
          cy - T * 0.06 + fy,
          T * 0.13,
          T * 0.16,
        );
        g.fillStyle(0x12131c, fade).fillCircle(
          cx + sd * T * 0.12 + fx * 1.4,
          cy - T * 0.05 + fy * 1.4,
          T * 0.035,
        );
      }
      if (p.shieldT > 0) g.lineStyle(T * 0.04, 0x4fd8ff, 0.8).strokeCircle(cx, cy, T * 0.5);
    }

    const alive = s.players.filter((p) => p.alive).length;
    const res = s.result
      ? s.result.winner !== null
        ? `câștigă ${LEVELS[s.result.winner]}`
        : 'egalitate'
      : `${alive} în viață`;
    const hurry = s.rules.hurryUpTick && s.tick >= s.rules.hurryUpTick ? ' · HURRY UP' : '';
    this.label.setText(
      `meci #${this.matchNo} · ${(s.tick / TICK_HZ).toFixed(0)}s · ${res}${hurry} · atinge = meci nou`,
    );
  }

  private drawItem(it: ItemType, px: number, py: number, T: number): void {
    const g = this.g;
    const neg = isNegative(it);
    const gold = isGold(it);
    const col = neg ? 0xff2d2d : gold ? 0xffd23f : (ITEM_COLOR[it] ?? 0xffffff);
    g.fillStyle(neg ? 0x3a0f14 : gold ? 0x3a2c05 : 0x232842).fillRoundedRect(
      px + T * 0.14,
      py + T * 0.14,
      T * 0.72,
      T * 0.72,
      T * 0.16,
    );
    g.lineStyle(T * 0.06, col).strokeRoundedRect(px + T * 0.14, py + T * 0.14, T * 0.72, T * 0.72, T * 0.16);
    g.fillStyle(col).fillCircle(px + T / 2, py + T / 2, T * 0.13);
  }
}
