import type { RngState } from './rng.ts';

/** Tipuri de pătrățele. */
export const EMPTY = 0;
export const HARD = 1;
export const SOFT = 2;
export type Tile = typeof EMPTY | typeof HARD | typeof SOFT;

/** Direcții: 0 sus, 1 jos, 2 stânga, 3 dreapta (aceeași ordine ca în prototip). */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX: readonly number[] = [0, 0, -1, 1];
export const DY: readonly number[] = [-1, 1, 0, 0];
export const opposite = (d: Dir): Dir => (d ^ 1) as Dir;

/** Unități de poziție pe pătrățel. Pozițiile sunt întregi ca simularea să fie identică pe orice platformă. */
export const U = 1000;

export type PositiveItem = 'bomb' | 'fire' | 'speed' | 'kick' | 'glove' | 'remote' | 'line' | 'shield';
/** Faza 4: bombe speciale (3 încărcături) și Blestem (adversarii −1 rază, 8s). */
export type SpecialKind = 'ice' | 'flash' | 'poison';
export type ExtraItem = SpecialKind | 'hex';
export type NegativeItem = 'slow' | 'shrink' | 'fewer' | 'reverse' | 'hiccup' | 'dizzy';
export type GoldItem = 'maxspeed' | 'maxfire' | 'maxbomb';
/** Doar în misiuni: inimă (+25% viață) și cristal (obiectiv; nu îl distrug flăcările). */
export type MissionItem = 'heart' | 'crystal';
/** `heart`: în misiuni +25% viață, în arenă +1 inimă (maxim 3). */
export type ItemType = PositiveItem | NegativeItem | GoldItem | MissionItem | ExtraItem;

/** Super-urile personajelor (Faza 4). */
export type SuperKind =
  | 'bigbomb'
  | 'dash'
  | 'sticky'
  | 'cluster'
  | 'purse'
  | 'timestop'
  | 'warp'
  | 'quake'
  | 'penalty'
  | 'boo'
  | 'swap'
  | 'smoke'
  | 'nova'
  | 'gate'
  | 'smash';
/** Abilitățile pasive care cer reguli în sim (statisticile de start sunt separate). */
export type PassiveKind = 'none' | 'bounce' | 'guard' | 'timers' | 'trap';

/**
 * Personajul unui jucător, cu afinitățile de arenă deja aplicate (le calculează packages/content).
 * Totul în întregi: viteza în procente, Super-ul în procente de încărcare.
 */
export interface HeroSpec {
  id: string;
  super: SuperKind;
  passive: PassiveKind;
  /** Trepte de viteză în plus la start (ca bonusul de viteză). */
  speedSteps: number;
  /** Procent aplicat vitezei (100 = neschimbat; afinități ±10–15). */
  speedPct: number;
  bombs: number;
  range: number;
  kick: boolean;
  /** Inimi în plus față de regula meciului (afinități, maxim +1). */
  lives: number;
  /** Viteza de încărcare a Super-ului, în procente. */
  superPct: number;
}

export type BotLevel = 'easy' | 'normal' | 'hard' | 'insane';
/** Ce controlează un jucător fără om: un nivel de bot sau un manechin (stă pe loc, nu pune bombe). */
export type BotKind = BotLevel | 'dummy';

/** Input-ul unui jucător pentru un tick. `bomb`: 0 nimic, 1 tap, 2 al doilea tap dintr-un dublu tap. */
export interface Input {
  dir: Dir | null;
  bomb?: 0 | 1 | 2;
  detonate?: boolean;
  /** Folosește Super-ul (dacă bara e plină). */
  super?: boolean;
  /** Schimbă tipul bombei speciale următoare (glisare în sus pe buton). */
  swap?: boolean;
  /** Direcția privirii (vederile 3D: bomba, aruncarea și linia merg unde se uită camera). */
  face?: Dir;
  /** Mișcare puternică (swipe) a joystick-ului: pornește alunecarea (personajele cu `kit.slide`). */
  slide?: boolean;
}

/**
 * Kitul unui personaj: statistici de start și abilități semnătură (datele vin din `packages/content`).
 * Semnăturile sunt permanente; aceleași abilități luate din arenă pot avea încărcări (`Rules.charges`).
 */
export interface CharKit {
  /** Viteză în unități pe tick (3.3 pătrățele/s = 165). */
  speed: number;
  range: number;
  bombs: number;
  maxBombs: number;
  /** Lovituri pe care le poate încasa (Gugu: 2). */
  lives: number;
  kick?: boolean;
  glove?: boolean;
  /** Nu poate lua Mănușa din arenă (Fotbalistul). */
  noGlove?: boolean;
  /** Nu poate lua Scutul din arenă. */
  noShield?: boolean;
  /** Scut la start (tick-uri). */
  shield?: number;
  /** Scutul luat din arenă durează doar atât la sută. */
  shieldPct?: number;
  /** Culege bonusurile pozitive din pătrățelele vecine. */
  magnet?: boolean;
  /** Imun la încetinire, inversare, amețeală, sughiț. */
  immune?: boolean;
  /** Prima bombă din rundă are +2 rază. */
  bigFirst?: boolean;
  /** Vede cronometrul bombelor (doar randare). */
  timers?: boolean;
  /** Bombele șutate ricoșează o dată din obstacol. */
  ricochet?: boolean;
  /** Flăcările bombelor lui lasă ulei care îi încetinește pe ceilalți. */
  oil?: boolean;
  /** Tick-uri în plus la fitilul bombelor. */
  fuseAdd?: number;
  /** Trece printr-o ladă, o dată la 20s. */
  ghost?: boolean;
  /** O dată pe rundă, bomba unui adversar care l-ar prinde devine porumbel. */
  pigeon?: boolean;
  /** Bombele lui explodează în arie (pătrat umplut în jurul bombei), nu în cruce. */
  burst?: boolean;
  /** Alunecare la mișcare puternică a joystick-ului (`Input.slide`): câteva pătrățele fără control. */
  slide?: boolean;
}

/** Încărcări pentru abilitățile luate din arenă (0 = nelimitat, dacă abilitatea e activă). */
export interface Charges {
  kick: number;
  glove: number;
  remote: number;
  line: number;
}
export type ChargeAbility = keyof Charges;

export interface Player {
  id: number;
  /** Personajul (id din content; doar informativ pentru randare) și kitul lui. */
  ch: string | null;
  kit: CharKit | null;
  maxBombs: number;
  charges: Charges;
  /** Prima bombă mare încă nefolosită (Bubu). */
  bigBomb: boolean;
  /** Tick-uri până poate trece iar printr-o ladă (Fantoma). */
  ghostT: number;
  /** Alunecarea (Slick): pătrățele rămase, direcția, pauza dintre alunecări, dacă sparge lăzi și cât mai e armat Smash. */
  slideLeft: number;
  slideDir: Dir;
  slideCd: number;
  smashing: boolean;
  smashT: number;
  /** Porumbelul a fost folosit în runda asta (Magicianul). */
  pigeonUsed: boolean;
  team: number;
  bot: BotKind | null;
  /** Punctul de start (pentru revenirea în joc). */
  sx: number;
  sy: number;
  /** Poziție în unități (pătrățel × U). */
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  face: Dir;
  /** Viteză în unități pe tick. */
  speed: number;
  bombs: number;
  range: number;
  active: number;
  kick: boolean;
  glove: boolean;
  remote: boolean;
  line: boolean;
  carry: number | null;
  tpLock: number;
  revT: number;
  hicT: number;
  hicCd: number;
  dizzyT: number;
  shieldT: number;
  graceT: number;
  /** Viață 0–100 (doar când `rules.health`; altfel o flacără = moarte). */
  hp: number;
  alive: boolean;
  deathTick: number;
  killerId: number | null;
  lastTapPlaced: boolean;
  botCd: number;
  /** Faza 4: personajul (null = fără personaj, ca în fazele anterioare). */
  hero: HeroSpec | null;
  /** Încărcarea Super-ului, 0…SUPER_FULL. */
  charge: number;
  /** Inimi rămase (o flacără ia o inimă; la 0 mori). */
  lives: number;
  /** Scutul pasiv (o lovitură pe meci) încă nefolosit. */
  guard: number;
  /** Invizibil pentru adversari (Super-ul Fantomei), tick-uri rămase. */
  hiddenT: number;
  /** Bombe speciale în așteptare, în ordinea folosirii (fiecare element = o încărcătură). */
  specials: SpecialKind[];
  frozenT: number;
  blindT: number;
  /** Cât a stat în norul toxic (tick-uri, se resetează când iese). */
  toxT: number;
  hexT: number;
  /** Coroana: cât a ținut-o (tick-uri). */
  crownT: number;
  /** Lumea infinită: locul e liber (jucătorul a plecat / botul a dispărut); se poate refolosi. */
  out: boolean;
  /** Statistici pe toată sesiunea (păstrate la revenire): eliminări, lăzi sparte, cea mai mare distanță de centru, tick-uri trăite. */
  kills: number;
  boxes: number;
  far: number;
  lived: number;
  /** Bonusurile pozitive culese de la ultima revenire (o parte cad pe jos la moarte, `Rules.infDrop`). */
  got: ItemType[];
}

export interface Fly {
  sx: number;
  sy: number;
  dir: Dir;
  steps: number;
  t: number;
  dur: number;
}

export interface Bomb {
  id: number;
  x: number;
  y: number;
  fuse: number;
  range: number;
  owner: number;
  remote: boolean;
  slide: Dir | null;
  prog: number;
  held: number | null;
  fly: Fly | null;
  chain: number;
  tpLock: number;
  /** Cum a ajuns bomba unde e: 0 pusă, 1 șutată, 2 aruncată (pentru provocări și statistici). */
  via: BombVia;
  /** Bombă mare (prima bombă a lui Bubu). */
  big?: boolean;
  /** Tipul exploziei: normală sau specială (gheață, flashbang, otravă). */
  kind: BombKind;
  /** Bombă de Super (nu ocupă din numărul de bombe al jucătorului). */
  free: boolean;
  /** Bombă lipicioasă: jucătorul de care s-a lipit (null = nelipită); `sticky` = încă poate lipi. */
  stuck: number | null;
  sticky: boolean;
  /** Ricoșeuri rămase la șut (Fotbalistul: 1; pasivul de erou: 2). */
  bounce: number;
  /** Raza exploziei în arie (0 = explozie în cruce, de lungime `range`). */
  area: number;
}

export type BombKind = 'normal' | SpecialKind;
/** Tipul flăcării pe pătrățel: 0 normală, 1 gheață, 2 flashbang, 3 otravă. */
export const FLAME_KIND: Record<BombKind, number> = { normal: 0, ice: 1, flash: 2, poison: 3 };

/** Poarta unui erou: două capete, `t` tick-uri rămase; doar `owner` și bombele lui o folosesc. */
export interface Gate {
  a: [number, number];
  b: [number, number];
  owner: number;
  t: number;
}

/** Capcana lăsată de Robo-Mici la moarte: explodează când calcă un adversar pe ea. */
export interface Trap {
  x: number;
  y: number;
  owner: number;
  t: number;
}

/** Coroana: cine o ține acumulează timp; cade la moarte. */
export interface Crown {
  x: number;
  y: number;
  holder: number | null;
  need: number;
}

/** Cartoful fierbinte: o bombă uriașă care trece de la un jucător la altul prin atingere. */
export interface Potato {
  holder: number | null;
  fuse: number;
  /** Tick-uri până poate fi pasat din nou (sau până apare cartoful următor). */
  cd: number;
}

export type BombVia = 0 | 1 | 2;
/** `flameVia`: 0–2 ca la bombă, 3 = fulger. */
export const VIA_LIGHTNING = 3;

/** Păianjen dintr-o ladă blestemată: aleargă spre cel mai apropiat jucător, atingerea omoară. */
export interface Spider {
  id: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  speed: number;
  life: number;
  wait: number;
}

/** Nor de furtună: plutește, se oprește, se încarcă (zonă anunțată) și trăsnește în cruce. */
export interface Cloud {
  id: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  speed: number;
  life: number;
  /** Tick-uri până la următoarea încărcare. */
  next: number;
  /** Tick-uri până la fulger (-1 = nu se încarcă). */
  charge: number;
  sx: number;
  sy: number;
}

/** Rânduri mobile: un rând (axis 0) sau o coloană (axis 1) anunțată, apoi alunecă pas cu pas. */
export interface Shift {
  axis: 0 | 1;
  idx: number;
  dir: 1 | -1;
  /** Tick-uri de avertizare rămase (dungă roșie). */
  warn: number;
  steps: number;
  /** Tick-uri de la ultimul pas (pentru animație). */
  stepT: number;
}

/** Arena rotativă: unghi și viteză în micro-grade (întregi, deterministe). */
export interface Rotation {
  a: number;
  v: number;
}

export interface Flag {
  team: number;
  hx: number;
  hy: number;
  x: number;
  y: number;
  carrier: number | null;
  /** Tick-uri până revine singur acasă (când e căzut). */
  dropT: number;
  atHome: boolean;
}

export interface Ctf {
  flags: [Flag, Flag];
  caps: [number, number];
  need: number;
}
export type DeathCause = 'flame' | 'hurry' | 'spider' | 'lightning' | 'crush' | 'poison' | 'potato';
export type MaxStat = 'speed' | 'bombs' | 'fire';

export type GameEvent =
  | { type: 'bombPlaced'; bomb: number; x: number; y: number; owner: number }
  | {
      type: 'explode';
      bomb: number;
      x: number;
      y: number;
      range: number;
      area: number;
      owner: number;
      chain: number;
    }
  | { type: 'boxDestroyed'; x: number; y: number; gold: boolean; cursed: boolean; owner: number }
  | { type: 'death'; player: number; killerId: number | null; cause: DeathCause; via: number }
  | { type: 'pickup'; player: number; item: ItemType; x: number; y: number }
  | { type: 'maxed'; player: number; stat: MaxStat }
  | { type: 'curse'; x: number; y: number; kind: 'spiders' | 'storm' }
  | { type: 'spiderDie'; id: number; x: number; y: number }
  | { type: 'cloudCharge'; id: number; x: number; y: number }
  | { type: 'strike'; x: number; y: number }
  | { type: 'cloudGone'; id: number }
  | { type: 'shiftWarn'; axis: 0 | 1; idx: number; dir: 1 | -1 }
  | { type: 'shiftStep'; axis: 0 | 1; idx: number; dir: 1 | -1 }
  | { type: 'pushed'; player: number; x: number; y: number }
  | { type: 'rotFlip' }
  | { type: 'flagTake'; team: number; player: number }
  | { type: 'flagDrop'; team: number; x: number; y: number }
  | { type: 'flagReturn'; team: number; player: number | null }
  | { type: 'capture'; team: number; player: number; caps: [number, number] }
  | { type: 'respawn'; player: number }
  /** Modul Infinit: bonusurile scăpate la moarte, boții care apar / dispar. */
  | { type: 'lootDrop'; player: number; x: number; y: number; n: number }
  | { type: 'botSpawn'; player: number; x: number; y: number }
  | { type: 'botGone'; player: number }
  | { type: 'hurt'; player: number; amount: number; hp: number }
  | { type: 'missionHit'; x: number; y: number; kind: TargetKind; done: boolean }
  | { type: 'missionProgress'; count: number; need: number }
  | { type: 'friendFree'; id: number }
  | { type: 'friendHome'; id: number }
  | { type: 'missionEnd'; won: boolean; reason: 'done' | 'time' | 'dead' }
  | { type: 'shieldSaved'; player: number }
  | { type: 'lifeLost'; player: number; lives: number }
  | { type: 'immune'; player: number; item: ItemType }
  | { type: 'pigeon'; player: number; bomb: number; x: number; y: number }
  | { type: 'ghostIn'; player: number; x: number; y: number }
  | { type: 'chargeOut'; player: number; ability: ChargeAbility }
  | { type: 'kick'; player: number; bomb: number }
  | { type: 'lift'; player: number; bomb: number }
  | { type: 'throw'; player: number; bomb: number }
  | { type: 'land'; bomb: number; x: number; y: number }
  | { type: 'teleport'; kind: 'player' | 'bomb'; id: number; x: number; y: number }
  | { type: 'portalOpen'; pads: [number, number][] }
  | { type: 'portalClose' }
  | { type: 'boxSpawn'; x: number; y: number; gold: boolean; cursed: boolean }
  | { type: 'hurryUp' }
  | { type: 'blockFall'; x: number; y: number }
  | { type: 'super'; player: number; kind: SuperKind }
  | { type: 'dash'; player: number; x: number; y: number }
  | { type: 'stick'; bomb: number; player: number }
  | { type: 'bounce'; bomb: number; x: number; y: number }
  | { type: 'frozen'; player: number }
  | { type: 'blinded'; player: number }
  | { type: 'trapSet'; x: number; y: number; owner: number }
  | { type: 'trapFire'; x: number; y: number; owner: number }
  | { type: 'timeStop'; owner: number }
  | { type: 'smokeBomb'; player: number; x: number; y: number }
  | { type: 'gateOpen'; owner: number; a: [number, number]; b: [number, number] }
  | { type: 'gateClose'; owner: number }
  | { type: 'slide'; player: number; dir: Dir; smash: boolean }
  | { type: 'bushBurn'; x: number; y: number }
  | { type: 'crownTake'; player: number }
  | { type: 'crownDrop'; x: number; y: number }
  | { type: 'potatoGive'; player: number; from: number | null }
  | { type: 'potatoBoom'; player: number; x: number; y: number }
  | { type: 'roundEnd'; winner: number | null; team: number | null };

/** `teams` și `ctf` sunt moduri pe echipe (foc prieten oprit implicit); `crown` și `potato` sunt toți contra toți. */
export type Mode = 'ffa' | 'teams' | 'ctf' | 'crown' | 'potato';

export interface Rules {
  width: number;
  height: number;
  mode: Mode;
  /** Probabilitatea unei lăzi pe un pătrățel liber (0.7 în prototip). */
  softDensity: number;
  /** Proporția de lăzi aurii (0.045; 0.07 în 1 vs 1). */
  goldRate: number;
  /** Proporția de lăzi blestemate (0.025; 0.02 în 1 vs 1). */
  curseRate: number;
  boxRespawn: boolean;
  /** În modurile pe echipe: bombele coechipierilor (și ale tale) te rănesc. */
  friendlyFire: boolean;
  /** Revenire în joc după N tick-uri (0 = eliminare definitivă). */
  respawnTicks: number;
  /** Scut primit la revenire (tick-uri). */
  respawnShield: number;
  /** Limita de timp a rundei (0 = fără). */
  timeLimit: number;
  /** Rânduri mobile. */
  shift: boolean;
  /** Arena rotativă. */
  rotate: boolean;
  /** Lume fără margini, generată din coordonate (misiuni, modul Infinit). */
  infinite: boolean;
  /** Modul Infinit: câți boți se țin în jurul fiecărui om (0 = fără boți). */
  infBots: number;
  /** Modul Infinit: procentul din bonusurile culese care cad pe jos la moarte. */
  infDrop: number;
  /** Bară de viață în loc de moarte la prima atingere. */
  health: boolean;
  /** Inimi printre drop-uri (misiuni). */
  hearts: boolean;
  /** Tick-ul la care începe „hurry up” (0 = dezactivat). */
  hurryUpTick: number;
  /** Tick-uri între două blocuri căzute în hurry up. */
  hurryEvery: number;
  /** Bonusuri primite de toți la start (1 vs 1). */
  startItems: ItemType[];
  /** Abilitățile luate din arenă (Picior, Mănușă, Detonator, Linie) vin cu încărcări; semnăturile rămân nelimitate. */
  charges: boolean;
  /** Inimi la start (1 = o flacără te elimină). */
  lives: number;
  /** Bonusurile din Faza 4 printre drop-uri: bombe speciale, Blestem, Inimă. */
  extras: boolean;
  /** Proporția de tufișuri pe pătrățelele libere. */
  bushRate: number;
  /** Șansa de drop dintr-o ladă, în procente față de normal (evenimentul „Lăzi grase”). */
  dropPct: number;
  /** Viteza bombelor șutate, în procente (evenimentul „Vânt”). */
  kickPct: number;
  /** Pătrățele în plus la aruncare (gravitație mică). */
  throwExtra: number;
  /** Fitilul bombelor (tick-uri). */
  fuse: number;
  /** Evenimentul de arenă tras din seed (doar pentru afișare; efectele sunt în celelalte reguli). */
  event: string | null;
}

export interface GameResult {
  winner: number | null;
  team: number | null;
  tick: number;
}

export interface GameState {
  seed: number;
  tick: number;
  rng: RngState;
  rules: Rules;
  W: number;
  H: number;
  grid: number[];
  flame: number[];
  flameOwner: number[];
  items: (ItemType | null)[];
  drops: (ItemType | null)[];
  gold: number[];
  cursed: number[];
  flameVia: number[];
  /** Ulei (Bucătarul): tick-uri rămase pe fiecare pătrățel și cine l-a lăsat. */
  oil: number[];
  oilOwner: number[];
  /** Faza 4: tipul flăcării (`FLAME_KIND`), norul toxic (tick-uri) și al cui e, tufișurile. */
  flameKind: number[];
  toxic: number[];
  toxicOwner: number[];
  bush: number[];
  /** Fum (bomba fumigenă): tick-uri rămase pe fiecare pătrățel. */
  smoke: number[];
  traps: Trap[];
  /** Super-ul „oprește timpul”: bombele celorlalți stau pe loc. */
  timeStop: { owner: number; t: number } | null;
  crown: Crown | null;
  potato: Potato | null;
  players: Player[];
  bombs: Bomb[];
  nextBombId: number;
  softStart: number;
  boxTimer: number;
  pads: [number, number][];
  portalT: number;
  /** Porțile eroilor (Portia): o pereche pe jucător, folosită doar de el și de bombele lui. */
  gates: Gate[];
  chainSeq: number;
  chainCount: Record<number, number>;
  hurryIdx: number;
  hurryOrder: number[];
  /** Lăzi blestemate sparte, care se declanșează după `t` tick-uri. */
  curses: { x: number; y: number; t: number }[];
  spiders: Spider[];
  clouds: Cloud[];
  nextMobId: number;
  shift: Shift | null;
  shiftNext: number;
  rot: Rotation | null;
  ctf: Ctf | null;
  inf: InfWorld | null;
  mission: MissionState | null;
  result: GameResult | null;
  events: GameEvent[];
}

/**
 * Lume infinită pe chunk-uri 32×32 (`world.ts`): stocarea e un șir de sloturi de câte 1024 de celule,
 * încărcate în jurul oamenilor și refolosite când rămân departe de toți. Slotul 0 e vidul (perete).
 */
export interface InfWorld {
  /** slot → cheia chunk-ului (`chunkKey`), -1 = liber. */
  keys: number[];
  /** cheia chunk-ului → slot. */
  slots: Record<number, number>;
  /** Sloturi libere (ultimul e cel mai mic). */
  free: number[];
}

export type MissionKind = 'collect' | 'demolish' | 'rescue' | 'race';
export type TargetKind = 'crystal' | 'tower' | 'cage' | 'flag';

/** Definiția unei misiuni (date; lista vine din packages/content). */
export interface MissionDef {
  id: string;
  kind: MissionKind;
  /** Câte ținte (cristale, turnuri, cuști; 1 la cursă). */
  count: number;
  /** Distanța țintelor față de start (pătrățele). */
  dmin: number;
  dmax: number;
  /** Turnuri blindate (2 explozii). */
  armored: number;
  /** Limită de timp în secunde (0 = fără). */
  timeLimit: number;
  /** Densitatea lăzilor (0.5; 0.3 la cursă). */
  softDensity: number;
  /** Stele: timp (s) sub care primești ★★ / ★★★ (cursă: secunde rămase minim) și viața minimă pentru ★★★. */
  stars: { two: number; three: number; hp: number };
  /** Păianjeni rătăcitori: maxim în jur și la câte secunde apare unul. */
  spiders: { max: number; every: number };
}

export interface MissionTarget {
  type: TargetKind;
  x: number;
  y: number;
  done: boolean;
  /** Cușca spartă / cristalul scos din ladă. */
  open: boolean;
  hp: number;
  maxHp: number;
}

/** Prieten salvat: te urmează, leșină 3s dacă îl prinde o flacără. */
export interface Friend {
  id: number;
  target: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  speed: number;
  faint: number;
  home: boolean;
}

export interface MissionState {
  def: MissionDef;
  count: number;
  need: number;
  targets: MissionTarget[];
  /** "x,y" → indexul țintei. */
  tmap: Record<string, number>;
  friends: Friend[];
  /** Tick-uri până la următorul păianjen rătăcitor. */
  spT: number;
  over: { won: boolean; reason: 'done' | 'time' | 'dead'; tick: number } | null;
}
