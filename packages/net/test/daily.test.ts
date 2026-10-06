import { describe, expect, it } from 'vitest';
import { botInput, challengeSetup, createGame, startChallenge, step, trackChallenge } from '@fitil/sim';
import { DAILY_ASPECT, dailyChallenge, encodeInput, replayDaily } from '../src/index.ts';
import type { WireInput } from '../src/index.ts';

/** Rulează provocarea cu AI-ul în locul omului și înregistrează input-urile lui, tick cu tick. */
function recordBotRun(d: ReturnType<typeof dailyChallenge>, ticks: number): WireInput[] {
  const s = createGame(challengeSetup(d.id, d.seed, DAILY_ASPECT));
  const prog = startChallenge(d.id);
  const log: WireInput[] = [];
  for (let t = 0; t < ticks; t++) {
    const inputs = s.players.map((p) => botInput(s, p.id));
    log.push(encodeInput(inputs[0]!));
    step(s, inputs);
    trackChallenge(prog, s);
    if (prog.status !== 'playing') break;
  }
  return log;
}

describe('provocarea zilei', () => {
  it('e aceeași într-o zi și variază între zile', () => {
    expect(dailyChallenge('2026-10-06')).toEqual(dailyChallenge('2026-10-06'));
    const ids = new Set(
      Array.from({ length: 30 }, (_, i) => dailyChallenge(`2026-10-${String(i + 1).padStart(2, '0')}`).id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('reluarea e deterministă: aceleași input-uri dau același rezultat', () => {
    const d = dailyChallenge('2026-10-06');
    const log = recordBotRun(d, 600);
    const a = replayDaily(d, log);
    expect(replayDaily(d, log)).toEqual(a);
    expect(a.ticks).toBeGreaterThan(0);
    expect(a.ticks).toBeLessThanOrEqual(log.length);
  });

  it('input-uri goale nu îndeplinesc provocarea', () => {
    const d = dailyChallenge('2026-10-07');
    expect(
      replayDaily(
        d,
        Array.from({ length: 200 }, () => [-1, 0, 0, -1, 0, 0] as WireInput),
      ).done,
    ).toBe(false);
  });
});
