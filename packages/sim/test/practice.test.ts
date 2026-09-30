import { describe, expect, it } from 'vitest';
import {
  FAST_LIMIT,
  FUSE,
  TUTORIAL_STEPS,
  challengeSetup,
  createGame,
  createTutorial,
  dummiesSetup,
  placeBomb,
  startChallenge,
  step,
  trackChallenge,
  tutorialDone,
  tutorialFailed,
} from '../src/index.ts';
import type { ChallengeProgress, GameState, Input, Player } from '../src/index.ts';
import { put } from './kit.ts';

/** Rulează pasul de tutorial cu o secvență de input-uri până e terminat. */
function play(
  step0: (typeof TUTORIAL_STEPS)[number],
  script: (t: number, s: GameState) => Input | undefined,
) {
  const { s, t } = createTutorial(step0);
  for (let i = 0; i < 400; i++) {
    step(s, [script(i, s)]);
    if (tutorialDone(s, t)) return { s, ok: true, tick: i };
    if (tutorialFailed(s)) return { s, ok: false, tick: i };
  }
  return { s, ok: false, tick: -1 };
}

describe('tutorial', () => {
  it('are 6 pași, fiecare cu hartă proprie', () => {
    expect(TUTORIAL_STEPS).toHaveLength(6);
    for (const st of TUTORIAL_STEPS) expect(createTutorial(st).s.players[0]!.alive).toBe(true);
  });

  it('1. mergi până la țintă', () => {
    expect(play('move', (t) => ({ dir: t < 60 ? 3 : 1 })).ok).toBe(true);
    expect(play('move', () => ({ dir: 3 })).ok).toBe(false);
  });

  it('2. bombă lângă ladă, apoi fugi', () => {
    // pune bomba la (3,1) și fuge în jos pe coloana 1 (lada de la (3,2) blochează în jos)
    const r = play('bomb', (t) =>
      t < 12 ? { dir: 3 } : t === 12 ? { dir: null, bomb: 1 } : { dir: t < 40 ? 2 : 1 },
    );
    expect(r.ok).toBe(true);
    // rămâi pe loc lângă bombă → mori → pasul se reia
    expect(
      play('bomb', (t) => (t < 12 ? { dir: 3 } : t === 12 ? { dir: null, bomb: 1 } : { dir: null })).ok,
    ).toBe(false);
  });

  it('3. ia un bonus', () => {
    expect(play('pickup', () => ({ dir: 3 })).ok).toBe(true);
  });

  it('4. șutează o bombă', () => {
    // merge la (3,1), pune bomba, se îndepărtează spre dreapta și se întoarce în ea → șut spre stânga
    const r = play('kick', (t) =>
      t < 12 ? { dir: 3 } : t === 12 ? { dir: null, bomb: 1 } : t < 25 ? { dir: 3 } : { dir: 2 },
    );
    expect(r.ok).toBe(true);
  });

  it('5. aruncă o bombă cu mănușa', () => {
    const r = play('glove', (t) =>
      t === 0
        ? { dir: null, bomb: 1 }
        : t === 1
          ? { dir: null, bomb: 1 }
          : t === 2
            ? { dir: null, bomb: 1 }
            : { dir: null },
    );
    expect(r.ok).toBe(true);
  });

  it('6. elimină manechinul', () => {
    const { s, t } = createTutorial('dummy');
    const d = s.players[1]!;
    const p = s.players[0]!;
    put(p, 7, 1);
    placeBomb(s, p, 7, 2);
    put(p, 9, 1);
    let ok = false;
    for (let i = 0; i < FUSE + 2 && !ok; i++) {
      step(s, []);
      ok = tutorialDone(s, t);
    }
    expect(d.alive).toBe(false);
    expect(ok).toBe(true);
  });
});

describe('manechine', () => {
  it('3 manechine care revin în joc, runda nu se termină', () => {
    const s = createGame(dummiesSetup(1, 16 / 9));
    expect(s.players.filter((p) => p.bot === 'dummy')).toHaveLength(3);
    for (let i = 0; i < 2000; i++) step(s, []);
    expect(s.result).toBeNull();
  });
});

function track(
  c: ChallengeProgress,
  s: GameState,
  events: GameState['events'],
  tick = s.tick,
): ChallengeProgress {
  s.events = events;
  s.tick = tick;
  return trackChallenge(c, s);
}

describe('provocări', () => {
  const game = () => {
    const s = createGame(challengeSetup('kicker', 1, 16 / 9));
    return s;
  };
  const death = (player: number, via: number) =>
    ({ type: 'death', player, killerId: 0, cause: 'flame', via }) as const;

  it('șutangiul: câștigă doar cu bombe șutate', () => {
    const s = game();
    expect(s.players[0]!.kick).toBe(true);
    let c = startChallenge('kicker');
    c = track(c, s, [death(1, 1)]);
    expect(c.status).toBe('playing');
    s.result = { winner: 0, team: null, tick: 100 };
    expect(track(c, s, []).status).toBe('done');
    const s2 = game();
    const c2 = track(startChallenge('kicker'), s2, [death(1, 0)]);
    expect(c2.status).toBe('failed');
  });

  it('artificierul: 5 lanțuri de 3+ bombe pornite de tine', () => {
    const s = game();
    let c = startChallenge('chains');
    for (let ch = 1; ch <= 5; ch++)
      for (let i = 0; i < 3; i++)
        c = track(c, s, [
          { type: 'explode', bomb: ch * 10 + i, x: 1, y: 1, range: 1, owner: i === 0 ? 0 : 2, chain: ch },
        ]);
    expect(c.count).toBe(5);
    expect(c.status).toBe('done');
    // lanțurile pornite de alții nu contează
    let c2 = startChallenge('chains');
    for (let i = 0; i < 3; i++)
      c2 = track(c2, s, [{ type: 'explode', bomb: i, x: 1, y: 1, range: 1, owner: 1, chain: 9 }]);
    expect(c2.count).toBe(0);
  });

  it('minimalistul: un singur bonus cules → eșec', () => {
    const s = game();
    const c = track(startChallenge('minimal'), s, [{ type: 'pickup', player: 0, item: 'fire', x: 1, y: 1 }]);
    expect(c.status).toBe('failed');
    const s2 = game();
    s2.result = { winner: 0, team: null, tick: 500 };
    expect(track(startChallenge('minimal'), s2, []).status).toBe('done');
  });

  it('fulgerul: victorie sub 60s', () => {
    const s = game();
    expect(track(startChallenge('fast'), s, [], FAST_LIMIT).status).toBe('failed');
    const s2 = game();
    s2.result = { winner: 0, team: null, tick: FAST_LIMIT - 1 };
    expect(track(startChallenge('fast'), s2, [], FAST_LIMIT - 1).status).toBe('done');
  });

  it('aruncătorul: 2 eliminări cu bombe aruncate; mori → eșec', () => {
    const s = game();
    let c = startChallenge('thrower');
    c = track(c, s, [death(1, 2)]);
    c = track(c, s, [death(2, 0)]);
    expect(c.count).toBe(1);
    c = track(c, s, [death(3, 2)]);
    expect(c.status).toBe('done');
    const s2 = game();
    (s2.players[0] as Player).alive = false;
    expect(track(startChallenge('thrower'), s2, []).status).toBe('failed');
  });

  it('determinist: o provocare jucată de boți dă același rezultat', () => {
    const run = () => {
      const s = createGame(challengeSetup('chains', 5, 4 / 3));
      s.players[0]!.bot = 'hard';
      let c = startChallenge('chains');
      for (let i = 0; i < 1500 && c.status === 'playing'; i++) {
        step(
          s,
          s.players.map(() => undefined),
        );
        c = trackChallenge(c, s);
      }
      return JSON.stringify(c);
    };
    expect(run()).toBe(run());
  });
});
