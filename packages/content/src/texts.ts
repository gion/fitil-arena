import { z } from 'zod';
import type { BotLevel, ChallengeId, DeathCause, ItemType, MaxStat, TutorialStep } from '@fitil/sim';

/** Modurile offline din Faza 2 (ordinea din selector). */
export const MODE_IDS = ['ffa', 'vs', 'team2', 'team3', 'ctf', 'rot', 'shift'] as const;
export type ModeId = (typeof MODE_IDS)[number];

const TextSchema = z.object({ name: z.string().min(1), desc: z.string().min(1) });

export const MODES: Record<ModeId, z.infer<typeof TextSchema>> = z
  .record(z.enum(MODE_IDS), TextSchema)
  .parse({
    ffa: { name: 'Free for all', desc: 'You against 3 bots. Last one standing wins.' },
    vs: {
      name: '1 vs 1',
      desc: 'A duel on a small arena. Both start with the same random power-ups.',
    },
    team2: { name: 'Teams 2v2', desc: 'You and a teammate against two bots. Friendly bombs can’t hurt you.' },
    team3: { name: 'Teams 3v3', desc: '3 against 3. Friendly bombs can’t hurt you.' },
    ctf: {
      name: 'Capture the flag',
      desc: '3 against 3. Steal the enemy flag and bring it to your base while your own flag is home. You respawn after 3s. First to 3 captures wins.',
    },
    rot: {
      name: 'Spinning arena',
      desc: 'Free for all on an arena that spins faster and faster and changes direction. The joystick follows the screen, so keep adjusting your aim.',
    },
    shift: {
      name: 'Shifting rows',
      desc: 'Free for all. Rows and columns slide from time to time, with everything on them. If a crate pushes you into a wall, you get squashed. Red arrows mark the next row.',
    },
  });

export const BOT_NAMES: Record<BotLevel, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  insane: 'Insane',
};

export const ITEM_NAMES: Record<ItemType, string> = {
  bomb: '+1 bomb',
  fire: '+1 range',
  speed: '+speed',
  kick: 'Kick',
  glove: 'Glove',
  remote: 'Detonator',
  line: 'Line',
  shield: 'SHIELD 10s',
  slow: 'Slowed!',
  shrink: 'Range −1!',
  fewer: 'Bomb −1!',
  reverse: 'Reversed controls!',
  dizzy: 'Dizzy! 10s',
  hiccup: 'Bomb hiccups!',
  maxspeed: 'MAX SPEED!',
  maxfire: 'MAX RANGE!',
  maxbomb: 'MAX BOMBS!',
  heart: '+25% health',
  crystal: 'Crystal!',
};

/** Replicile momentelor de glorie (localizabile; în versiunea finală pot veni din pachete de voce). */
export const HERO_LINES: Record<MaxStat | 'win' | 'team', string[]> = {
  speed: ['I’m lightning!', 'Catch me if you can!', 'Zoooom!', 'Brakes are optional.'],
  bombs: ['Bombs for days!', 'Who wants fireworks?', 'Bomb shop: open!'],
  fire: ['My blast covers everything!', 'All the way to the horizon!', 'Maximum heat!'],
  win: ['Too easy!', 'I’m a legend!', 'Who’s next?', 'Applause, please!'],
  team: ['Unstoppable team!', 'Teamwork!', 'Champions, baby!'],
};

/** Ce strigă personajele când mor. */
export const QUIPS = ['Ouch!', 'Oh no!', 'Mommy!', 'Not fair!', 'Again?!', 'My mustache!', 'Help!'];
export const TAUNTS = ['Hehe!', 'Too easy!', 'Ha ha ha!'];
export const BYE = 'bye bye…';

/** Mesajul de moarte al jucătorului. `{k}` = numele ucigașului. */
export const DEATH_MSG: Record<DeathCause | 'self', string> = {
  flame: 'Toasted by {k}!',
  self: 'You blew yourself up.',
  hurry: 'Squashed by the shrinking arena!',
  spider: 'Got by a spider!',
  lightning: 'Zapped by lightning!',
  crush: 'Squashed by a shifting row!',
};

export const TEAMS = [
  { name: 'Blue', color: '#3d8bff', bomb: '#2356c9' },
  { name: 'Red', color: '#ff5a4d', bomb: '#c62d22' },
] as const;

/** Numele și culorile personajelor din meciurile offline (nume de lucru, originale). */
export const ROSTER = {
  ffa: [
    { name: 'You', color: '#5ad15a' },
    { name: 'Bubu', color: '#f3f1ea' },
    { name: 'Zuzu', color: '#9a6436' },
    { name: 'Gogu', color: '#2fd3c6' },
  ],
  teams: [
    [
      { name: 'You', color: '#3d8bff' },
      { name: 'Lulu', color: '#8cc0ff' },
      { name: 'Titi', color: '#1d56c4' },
    ],
    [
      { name: 'Bubu', color: '#ff5a4d' },
      { name: 'Zuzu', color: '#ffa070' },
      { name: 'Gogu', color: '#b8231a' },
    ],
  ],
  dummy: { name: 'Dummy', color: '#d8c7a0' },
} as const;

export const CHALLENGE_TEXT: Record<ChallengeId, { name: string; desc: string }> = {
  kicker: { name: 'The Kicker', desc: 'Win a match where every one of your eliminations is a kicked bomb.' },
  chains: { name: 'Pyrotechnician', desc: 'Set off 5 chains of at least 3 bombs in one match.' },
  minimal: { name: 'Minimalist', desc: 'Win without picking up a single power-up.' },
  fast: { name: 'Lightning', desc: 'Win in under 60 seconds.' },
  thrower: { name: 'The Thrower', desc: 'Eliminate 2 opponents with bombs thrown with the glove.' },
};

export const TUTORIAL_TEXT: Record<TutorialStep, { title: string; hint: string }> = {
  move: {
    title: 'Move',
    hint: 'Hold your finger on the left side of the screen and drag toward the gold circle.',
  },
  bomb: {
    title: 'Bomb',
    hint: 'Walk next to the crate, tap the right side of the screen to drop a bomb, then get out of the cross!',
  },
  pickup: {
    title: 'Power-ups',
    hint: 'Step on a power-up to grab it. A red border with “−” means a bad one.',
  },
  kick: { title: 'Kick', hint: 'You have Kick: drop a bomb, step back, then walk into it to kick it.' },
  glove: {
    title: 'Glove',
    hint: 'You have Glove: drop a bomb, tap again to pick it up, and once more to throw it over walls.',
  },
  dummy: {
    title: 'Target',
    hint: 'The dummy is behind the crate. Break the crate and catch it in the blast!',
  },
};

/** Prietenii din cuști (misiunea Salvare). */
export const FRIEND_NAMES = ['Mimi', 'Pufi', 'Cuca', 'Lulu'];

export const MISSION_END: Record<'time' | 'dead', string> = {
  time: 'Time’s up.',
  dead: 'You ran out of health.',
};
