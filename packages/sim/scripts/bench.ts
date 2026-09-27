/**
 * pnpm sim:bench [meciuri=1000]
 * Rulează meciuri bot-vs-bot headless și raportează excepții, meciuri neterminate în 5 min simulate,
 * durata medie, victorii pe nivel de bot și un control de determinism (10 meciuri rulate de două ori).
 */
import {
  TICK_HZ,
  collectInputs,
  createGame,
  duelRules,
  gridForAspect,
  hashState,
  step,
} from '../src/index.ts';
import type { BotLevel, GameSetup } from '../src/index.ts';

const N = Number(process.argv[2] ?? 1000);
const MAX_TICKS = 5 * 60 * TICK_HZ;
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'insane'];

function setupFor(seed: number): GameSetup {
  const kind = seed % 5;
  if (kind === 3)
    return {
      seed,
      rules: duelRules(seed),
      players: [{ bot: LEVELS[seed % 4]! }, { bot: LEVELS[(seed + 1) % 4]! }],
    };
  if (kind === 4)
    return {
      seed,
      rules: { mode: 'teams', ...gridForAspect(19.5 / 9) },
      players: [0, 0, 0, 1, 1, 1].map((team, i) => ({ bot: LEVELS[(seed + i) % 4]!, team })),
    };
  const aspect = [16 / 9, 4 / 3, 9 / 19.5][kind]!;
  return {
    seed,
    rules: gridForAspect(aspect),
    players: LEVELS.map((_, i) => ({ bot: LEVELS[(seed + i) % 4]! })),
  };
}

function playMatch(seed: number) {
  const setup = setupFor(seed);
  const s = createGame(setup);
  while (!s.result && s.tick < MAX_TICKS) step(s, collectInputs(s));
  return { s, setup };
}

const t0 = performance.now();
let errors = 0;
let timeouts = 0;
let totalTicks = 0;
let draws = 0;
let hurry = 0;
const wins: Record<BotLevel, number> = { easy: 0, normal: 0, hard: 0, insane: 0 };
const played: Record<BotLevel, number> = { easy: 0, normal: 0, hard: 0, insane: 0 };
let longest = 0;

for (let seed = 1; seed <= N; seed++) {
  try {
    const { s, setup } = playMatch(seed);
    if (!s.result) {
      timeouts++;
      continue;
    }
    totalTicks += s.tick;
    longest = Math.max(longest, s.tick);
    if (s.tick >= s.rules.hurryUpTick) hurry++;
    if (setup.rules?.mode !== 'teams') {
      for (const p of s.players) played[p.bot!]++;
      if (s.result.winner === null) draws++;
      else wins[s.players[s.result.winner]!.bot!]++;
    } else if (s.result.team === null) draws++;
  } catch (e) {
    errors++;
    if (errors <= 3) console.error(`seed ${seed}:`, e);
  }
}

let desync = 0;
for (let seed = 1; seed <= 10; seed++)
  if (hashState(playMatch(seed).s) !== hashState(playMatch(seed).s)) desync++;

const done = N - errors - timeouts;
const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '0') + '%';
console.log(`sim:bench — ${N} meciuri în ${((performance.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  excepții: ${errors} · neterminate în 5 min: ${timeouts} · desync (10 re-rulări): ${desync}`);
console.log(
  `  durată medie: ${(totalTicks / Math.max(1, done) / TICK_HZ).toFixed(1)}s · cel mai lung: ${(longest / TICK_HZ).toFixed(1)}s · au ajuns la hurry up: ${pct(hurry, done)} · egaluri: ${pct(draws, done)}`,
);
console.log(
  '  rată de victorie pe nivel (FFA + 1v1): ' +
    LEVELS.map((l) => `${l} ${pct(wins[l], played[l])}`).join(' · '),
);
if (errors || timeouts || desync) process.exit(1);
