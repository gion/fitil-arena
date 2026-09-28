import { z } from 'zod';
import type { BotLevel, ChallengeId, DeathCause, ItemType, MaxStat, TutorialStep } from '@fitil/sim';

/** Modurile offline din Faza 2 (ordinea din selector). */
export const MODE_IDS = ['ffa', 'vs', 'team2', 'team3', 'ctf', 'rot', 'shift'] as const;
export type ModeId = (typeof MODE_IDS)[number];

const TextSchema = z.object({ name: z.string().min(1), desc: z.string().min(1) });

export const MODES: Record<ModeId, z.infer<typeof TextSchema>> = z
  .record(z.enum(MODE_IDS), TextSchema)
  .parse({
    ffa: { name: 'Toți contra toți', desc: 'Tu contra 3 boți. Ultimul rămas câștigă.' },
    vs: {
      name: '1 vs 1',
      desc: 'Duel pe o arenă mică. Amândoi pornesc cu aceleași bonusuri alese la întâmplare.',
    },
    team2: { name: 'Echipe 2v2', desc: 'Tu și un coleg contra a doi boți. Bombele colegilor nu vă rănesc.' },
    team3: { name: 'Echipe 3v3', desc: '3 contra 3. Bombele colegilor nu vă rănesc.' },
    ctf: {
      name: 'Capturează steagul',
      desc: '3 contra 3. Fură steagul adversarilor și adu-l la baza ta, cât timp steagul tău e acasă. Revii în joc după 3s. Primii la 3 capturi câștigă.',
    },
    rot: {
      name: 'Arena rotativă',
      desc: 'Toți contra toți pe o arenă care se rotește tot mai repede și își schimbă sensul. Joystick-ul urmează ecranul, deci trebuie să-ți ajustezi direcția.',
    },
    shift: {
      name: 'Rânduri mobile',
      desc: 'Toți contra toți. Rânduri și coloane alunecă periodic, cu tot ce e pe ele. Dacă o ladă te împinge în perete, ești strivit. Săgețile roșii anunță rândul.',
    },
  });

export const BOT_NAMES: Record<BotLevel, string> = {
  easy: 'Ușor',
  normal: 'Normal',
  hard: 'Greu',
  insane: 'Nebun',
};

export const ITEM_NAMES: Record<ItemType, string> = {
  bomb: '+1 bombă',
  fire: '+1 rază',
  speed: '+viteză',
  kick: 'Picior',
  glove: 'Mănușă',
  remote: 'Detonator',
  line: 'Linie',
  shield: 'SCUT 10s',
  slow: 'Încetinit!',
  shrink: 'Rază −1!',
  fewer: 'Bombă −1!',
  reverse: 'Comenzi inversate!',
  dizzy: 'Amețit! 10s',
  hiccup: 'Sughiț de bombe!',
  maxspeed: 'VITEZĂ MAXIMĂ!',
  maxfire: 'RAZĂ MAXIMĂ!',
  maxbomb: 'BOMBE MAXIME!',
  heart: '+25% viață',
  crystal: 'Cristal!',
};

/** Replicile momentelor de glorie (localizabile; în versiunea finală pot veni din pachete de voce). */
export const HERO_LINES: Record<MaxStat | 'win' | 'team', string[]> = {
  speed: ['Sunt fulger!', 'Prindeți-mă dacă puteți!', 'Vâjjj!', 'Frânele sunt opționale.'],
  bombs: ['Am bombe pentru o lună!', 'Cine vrea artificii?', 'Magazinul de bombe: deschis!'],
  fire: ['Raza mea acoperă tot!', 'Până la orizont!', 'Căldură maximă!'],
  win: ['Prea ușor!', 'Sunt legendă!', 'Cine urmează?', 'Aplauze, vă rog!'],
  team: ['Echipa bate tot!', 'Muncă de echipă!', 'Noi suntem campionii!'],
};

/** Ce strigă personajele când mor. */
export const QUIPS = [
  'Au!',
  'Aoleu!',
  'Mamă, mamă!',
  'Nu e corect!',
  'Iar?!',
  'Mi-a ars mustața!',
  'Săriți!',
];
export const TAUNTS = ['Hehe!', 'Prea ușor!', 'Ha ha ha!'];
export const BYE = 'bye bye…';

/** Mesajul de moarte al jucătorului. `{k}` = numele ucigașului. */
export const DEATH_MSG: Record<DeathCause | 'self', string> = {
  flame: 'Prăjit de {k}!',
  self: 'Te-ai aruncat singur în aer.',
  hurry: 'Strivit de arena care se strânge!',
  spider: 'Prăjit de un păianjen!',
  lightning: 'Prăjit de fulger!',
  crush: 'Strivit de rândul mobil!',
};

export const TEAMS = [
  { name: 'Albaștrii', color: '#3d8bff', bomb: '#2356c9' },
  { name: 'Roșii', color: '#ff5a4d', bomb: '#c62d22' },
] as const;

/** Numele și culorile personajelor din meciurile offline (nume de lucru, originale). */
export const ROSTER = {
  ffa: [
    { name: 'Tu', color: '#5ad15a' },
    { name: 'Bubu', color: '#f3f1ea' },
    { name: 'Zuzu', color: '#9a6436' },
    { name: 'Gogu', color: '#2fd3c6' },
  ],
  teams: [
    [
      { name: 'Tu', color: '#3d8bff' },
      { name: 'Lulu', color: '#8cc0ff' },
      { name: 'Titi', color: '#1d56c4' },
    ],
    [
      { name: 'Bubu', color: '#ff5a4d' },
      { name: 'Zuzu', color: '#ffa070' },
      { name: 'Gogu', color: '#b8231a' },
    ],
  ],
  dummy: { name: 'Manechin', color: '#d8c7a0' },
} as const;

export const CHALLENGE_TEXT: Record<ChallengeId, { name: string; desc: string }> = {
  kicker: { name: 'Șutangiul', desc: 'Câștigă un meci în care toate eliminările tale sunt cu bombe șutate.' },
  chains: { name: 'Artificierul', desc: 'Pornește 5 lanțuri de cel puțin 3 bombe într-un meci.' },
  minimal: { name: 'Minimalistul', desc: 'Câștigă fără să culegi niciun bonus.' },
  fast: { name: 'Fulgerul', desc: 'Câștigă în mai puțin de 60 de secunde.' },
  thrower: { name: 'Aruncătorul', desc: 'Elimină 2 adversari cu bombe aruncate cu mănușa.' },
};

export const TUTORIAL_TEXT: Record<TutorialStep, { title: string; hint: string }> = {
  move: { title: 'Mergi', hint: 'Ține degetul în stânga ecranului și trage spre cercul auriu.' },
  bomb: {
    title: 'Bombă',
    hint: 'Mergi lângă ladă, atinge dreapta ecranului ca să pui bomba, apoi fugi din cruce!',
  },
  pickup: {
    title: 'Bonusuri',
    hint: 'Calcă pe un bonus ca să-l iei. Chenarul roșu cu „−” înseamnă bonus rău.',
  },
  kick: { title: 'Picior', hint: 'Ai Picior: pune o bombă, fă un pas înapoi și mergi în ea ca s-o șutezi.' },
  glove: {
    title: 'Mănușă',
    hint: 'Ai Mănușă: pune bomba, atinge iar ca s-o ridici, încă o dată ca s-o arunci peste ziduri.',
  },
  dummy: { title: 'Țintă', hint: 'Manechinul stă după ladă. Sparge lada și prinde-l în flacără!' },
};

/** Prietenii din cuști (misiunea Salvare). */
export const FRIEND_NAMES = ['Mimi', 'Pufi', 'Cuca', 'Lulu'];

export const MISSION_END: Record<'time' | 'dead', string> = {
  time: 'Timpul a expirat.',
  dead: 'Ai rămas fără viață.',
};
