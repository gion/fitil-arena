import type Phaser from 'phaser';
import {
  CHALLENGES,
  DEG,
  MAX_BOMBS,
  MAX_RANGE,
  SPEED_MAX,
  SPEED_START,
  SPEED_STEP,
  SUPER_FULL,
  TICK_HZ,
  TUTORIAL_STEPS,
  U,
  infScore,
  isGold,
  isNegative,
  missionGoal,
  missionStars,
} from '@fitil/sim';
import type { BotLevel, ChallengeId, Dir, GameState, TutorialStep } from '@fitil/sim';
import {
  BOT_NAMES,
  CHAPTERS,
  FRIEND_NAMES,
  MISSION_END,
  chapterUnlocked,
  missionById,
  missionUnlocked,
  CHALLENGE_TEXT,
  HEART_ARENA,
  ITEM_NAMES,
  affinity,
  arenaEventById,
  MODES,
  MODE_IDS,
  MENU_LINES,
  QUIPS,
  TAUNTS,
  TEAMS,
  THEMES,
  TUTORIAL_TEXT,
  seasonalTheme,
  themeById,
  CAT_NAMES,
  defaultProfile,
  LEGAL,
  LEGAL_PLACEHOLDER,
  emoteById,
  fatalityById,
  CHARACTERS,
  MAX_LEVEL,
  RARITY,
  SHOP,
  SHOP_CATS,
  buyChar,
  buyItem,
  charById,
  charPrice,
  equip,
  levelOf,
  levelRewards,
  reward,
  selectChar,
  shopItem,
  buyTheme,
  canPlay,
  charState,
  markSeen,
  modeLock,
  openKeys,
  playerLevel,
  themeOpen,
  themeState,
  totalXp,
} from '@fitil/content';
import type { MatchSummary, ModeId, Outfit, Profile, Rewards, ShopCat, Theme } from '@fitil/content';
import { Music } from './audio/music.ts';
import { Sfx } from './audio/sfx.ts';
import { DEFAULT_VOICE, FileVoice, SynthVoice } from './audio/voice.ts';
import type { VoicePack } from './audio/voice.ts';
import { Match } from './game/match.ts';
import type { MatchEvent } from './game/match.ts';
import type { PlayKind } from './game/setup.ts';
import { vibrate } from './haptics.ts';
import { Controls, quantize } from './input/controls.ts';
import type { ArenaScene } from './render/ArenaScene.ts';
import type { Renderer3D } from './render3d/Renderer3D.ts';
import { applySkin, currentSkin, currentTheme, save, settings } from './settings.ts';
import type { Quality, View } from './settings.ts';
import { $, h, show } from './ui/dom.ts';
import { account } from './online/account.ts';
import type { Op } from './online/account.ts';
import { OnlineSession } from './online/session.ts';
import { InfiniteSession } from './online/infinite.ts';
import { store, today } from './profile.ts';
import { DEV_TOOLS, now } from './clock.ts';
import { Portraits, lookColor } from './ui/portrait.ts';
import { FatPreviews } from './ui/fatPreview.ts';
import type * as paint from './render/paint.ts';
import {
  burst,
  btn,
  caption,
  coins,
  head,
  icon,
  installPress,
  lock,
  panel,
  rays,
  say,
  seg,
  sq,
  stampSwitch,
  tag,
} from './ui/comic.ts';

/** Build-ul demo (GitHub Pages) n-are server de joc: fără meniul Online (`VITE_OFFLINE_ONLY=1`). */
const OFFLINE_ONLY = import.meta.env.VITE_OFFLINE_ONLY === '1';

type Phase = 'menu' | 'play' | 'paused' | 'over';

const ABILITY = { kick: 'Kick', glove: 'Glove', remote: 'Detonator', line: 'Line' } as const;
const pickOne = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;
const VIEWS: View[] = ['2d', 'fps', 'chase'];
const VIEW_LBL: Record<View, string> = { '2d': '2D', fps: '1P', chase: '3P' };
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Prima propoziție (subtitlul cardului de mod). */
const firstSentence = (t: string): string => t.split(/(?<=\.)\s/)[0]!.replace(/\.$/, '');
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'insane'];

export class App {
  readonly sfx = new Sfx();
  readonly music = new Music(this.sfx);
  voice: VoicePack;
  private synth: SynthVoice;
  private voiceLoading = false;
  theme: Theme = this.allowedTheme();
  match: Match | null = null;
  online: OnlineSession | null = null;
  /** Lumea Infinit online (D-070). */
  inf: InfiniteSession | null = null;
  private onlineErr = '';
  private portraits = new Portraits();
  private fatPreviews = new FatPreviews();
  /** Ce ai făcut în meciul curent (pentru monede și XP). */
  private sum: MatchSummary = { boxes: 0, kills: 0, won: false, team: false, caps: 0, stars: 0 };
  kind: PlayKind = { type: 'mode', mode: settings.mode };
  phase: Phase = 'menu';
  view: View = '2d';
  r3: Renderer3D | null = null;
  private r3loading: Promise<Renderer3D | null> | null = null;
  private scores: number[] = [];
  private controls: Controls;
  private lastTapT = -1e9;
  private rotHeld: Dir | null = null;
  private hudKey = '';
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private hintsHidden = false;
  private seedN = (Date.now() >>> 0) % 1_000_000;
  private screen: () => HTMLElement = () => this.mainMenu();
  /** Personajul mare al ecranului: balonul lui (reacții). */
  private sayEl: HTMLElement | null = null;
  private sayTimer: ReturnType<typeof setTimeout> | undefined;
  private lastLine = '';
  /** Personajul arătat în grila de personaje / obiectul ales în magazin (previzualizare). */
  private castPick: string | null = null;
  private shopPick: string | null = null;
  private sheetOpen = false;
  private fxTimer: ReturnType<typeof setTimeout> | undefined;
  private fxBusy = false;
  /** Ordinea eliminărilor din runda curentă (pentru clasamentul de final). */
  private deaths: { player: number; note: string }[] = [];
  private applyMotion: () => void = () => {};

  // elemente
  private ui = $('#ui');
  private chips!: HTMLElement;
  private clock!: HTMLElement;
  private stats!: HTMLElement;
  /** Infinit: clasamentul (online) și minimapa. */
  private side!: HTMLElement;
  private board!: HTMLElement;
  private mini!: HTMLCanvasElement;
  private miniT = 0;
  private frameEl!: HTMLElement;
  private conn!: HTMLElement;
  private fx!: HTMLElement;
  private viewBtn!: HTMLButtonElement;
  private emoteBtn!: HTMLButtonElement;
  private menuBtn!: HTMLButtonElement;
  private overlay!: HTMLElement;
  private drawer!: HTMLElement;
  private banner!: HTMLElement;
  private bubble!: HTMLElement;
  private toast!: HTMLElement;
  private tut!: HTMLElement;
  private arrow!: HTMLElement;
  private det!: HTMLElement;
  private bomb3!: HTMLElement;
  private sup!: HTMLElement;
  private spec!: HTMLElement;
  private dark!: HTMLElement;
  private hints!: HTMLElement[];

  constructor(
    readonly game: Phaser.Game,
    readonly scene: ArenaScene,
  ) {
    this.sfx.theme = this.theme;
    this.synth = new SynthVoice(this.sfx);
    this.voice = this.synth;
    this.buildDom();
    this.controls = new Controls({
      left: $('.zone.left', this.ui),
      right: $('.zone.right', this.ui),
      base: $('.joy-base', this.ui),
      knob: $('.joy-knob', this.ui),
      bomb3: this.bomb3,
      det: this.det,
      sup: this.sup,
      spec: this.spec,
    });
    this.controls.onSuper = () => {
      const m = this.match;
      if (m && m.me.hero && m.me.charge >= SUPER_FULL) {
        m.useSuper();
        vibrate([20, 30, 40]);
      }
    };
    this.controls.onSwap = () => {
      if (this.match && this.match.me.specials.length) this.match.swapSpecial();
    };
    this.controls.onTap = () => this.humanTap();
    this.controls.onDetonate = () => {
      if (this.match?.hasRemote) {
        this.match.detonate();
        vibrate([30, 20, 60]);
      }
    };
    this.controls.onFirstTouch = () => this.hideHints();
    this.controls.onKey = (code) => {
      if (code === 'Escape' || code === 'KeyP') this.togglePause();
      if (code === 'KeyV' && this.phase === 'play') this.cycleView();
    };
    scene.onFrame = (dt) => this.frame(dt);
    scene.setTheme(this.theme);
    scene.motion = settings.motion;
    this.applyTheme();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'play') this.pause();
    });
    this.showScreen(() => this.mainMenu());
    this.setView(settings.view, false);
    // cont anonim (în fundal): dacă serverul nu răspunde, jocul rămâne offline
    if (!OFFLINE_ONLY)
      void account.bootstrap(store.real).then((p) => {
        if (!p) return;
        this.adopt(p);
        void account.flushClaims((q) => this.adopt(q));
      });
    if (!OFFLINE_ONLY) void OnlineSession.resume().then((o) => o && !this.online && this.enterRoom(o));
  }

  /* ---------- DOM ---------- */

  private buildDom(): void {
    this.chips = h('div', { class: 'chips' });
    this.clock = h('div', { class: 'clock', 'aria-label': 'Time' });
    this.stats = h('div', { class: 'stats' });
    this.viewBtn = h(
      'button',
      {
        class: 'viewbtn',
        'aria-label': 'Change camera view',
        'data-test': 'view',
        onclick: () => this.cycleView(),
      },
      '2D',
    );
    this.menuBtn = h(
      'button',
      { class: 'pausebtn', 'aria-label': 'Pause', 'data-test': 'pause', onclick: () => this.togglePause() },
      icon.pause(),
    );
    this.emoteBtn = h(
      'button',
      {
        class: 'viewbtn hidden',
        'aria-label': 'Emote',
        'data-test': 'emote',
        onclick: () => this.match?.emote(),
      },
      '😀',
    );
    const bar = h(
      'div',
      { class: 'hudbar' },
      this.chips,
      this.clock,
      this.stats,
      this.emoteBtn,
      this.viewBtn,
      this.menuBtn,
    );
    this.frameEl = h('div', { class: 'frame hidden', 'aria-hidden': 'true' });
    this.board = h('ol', { class: 'lb', 'aria-label': 'Top 10', 'data-test': 'board' });
    this.mini = h('canvas', {
      class: 'minimap',
      width: 132,
      height: 132,
      'aria-label': 'Map',
      'data-test': 'minimap',
    });
    this.side = h('div', { class: 'infside hidden' }, this.board, this.mini);
    const left = h(
      'div',
      { class: 'zone left' },
      h('div', { class: 'joy-base hidden' }, h('div', { class: 'joy-knob' })),
    );
    const right = h('div', { class: 'zone right', 'aria-label': 'Bomb' });
    this.det = h('button', { class: 'ctl det hidden', 'aria-label': 'Detonate' }, 'BOOM!');
    this.bomb3 = h('button', { class: 'ctl bomb3 hidden', 'aria-label': 'Drop bomb' }, 'BOMB');
    this.sup = h('button', { class: 'ctl sup hidden', 'aria-label': 'Super', 'data-test': 'super' }, 'SUPER');
    this.spec = h(
      'button',
      { class: 'ctl spec hidden', 'aria-label': 'Next special bomb. Swipe up to switch.' },
      h('i'),
      h('b'),
    );
    this.dark = h('div', { class: 'dark3 hidden' });
    this.hints = [
      h('div', { class: 'hint l' }, 'Drag on this side to move'),
      h('div', { class: 'hint r' }, h('span', {}, 'Tap anywhere on this side to drop a bomb')),
    ];
    this.overlay = h('div', { class: 'overlay' });
    this.drawer = h('div', { class: 'drawer hidden' });
    this.conn = h('div', { class: 'drawer hidden', 'data-test': 'conn' });
    this.banner = h('div', { class: 'banner hidden' });
    this.bubble = h('div', { class: 'bubble hidden' });
    this.toast = h('div', { class: 'toast hidden' });
    this.tut = h('div', { class: 'tut hidden' });
    this.arrow = h('div', { class: 'obj-arrow hidden' }, h('b'), h('span'));
    this.fx = h('div', { class: 'fx hidden' });
    this.ui.append(
      this.frameEl,
      bar,
      this.side,
      left,
      right,
      this.det,
      this.bomb3,
      this.sup,
      this.spec,
      this.dark,
      ...this.hints,
      this.banner,
      this.bubble,
      this.toast,
      this.tut,
      this.arrow,
      this.drawer,
      this.conn,
      this.overlay,
    );
    document.body.append(this.fx);
    installPress(this.ui, {
      sound: (k) => {
        this.sfx.init();
        this.sfx.ui(k);
      },
      vibrate: (p) => vibrate(p),
      locked: (el) => {
        this.react('sad', el.dataset.why ?? MENU_LINES.locked);
      },
      touched: (x, y) => this.portraits.touched(x, y),
    });
    const still = () => {
      const on = !settings.motion || document.hidden;
      document.body.classList.toggle('still', on);
      this.portraits.motion = !on;
    };
    still();
    document.addEventListener('visibilitychange', still);
    this.applyMotion = still;
  }

  /** Tema schimbă doar arena (D-052): interfața rămâne aceeași. */
  private applyTheme(): void {
    this.hudKey = '';
  }

  /** Tema aleasă, dacă profilul curent o are deschisă; altfel tema de sezon sau Clasic. */
  private allowedTheme(): Theme {
    const t = currentTheme();
    if (themeOpen(store.profile, t.id, store.access())) return t;
    const season = seasonalTheme(now());
    return season && themeOpen(store.profile, season.id, store.access()) ? season : themeById('clasic');
  }

  /** Personajul cu care joci: cel ales, dacă încă îl poți folosi (rotația gratuită se poate termina). */
  private playCh(): string {
    const p = store.profile;
    return canPlay(p, p.ch, store.access()) ? p.ch : 'bubu';
  }

  /** Insigna „NEW” pentru deblocările nevăzute de un tip (`mode`, `char`, `theme`). */
  private fresh(kind: string): string[] {
    const p = store.profile;
    return openKeys(p, store.access()).filter((k) => k.startsWith(kind + ':') && !p.seen.includes(k));
  }

  private newBadge(kind: string): HTMLElement | null {
    return this.fresh(kind).length ? tag('NEW!', 'new pulse') : null;
  }

  private seeAll(kind: string): void {
    const keys = this.fresh(kind);
    if (keys.length) store.set(markSeen(store.profile, keys));
  }

  /** `persist = false`: tema camerei online, fără să schimbe tema aleasă de jucător. */
  setTheme(id: string, persist = true): void {
    if (persist) {
      settings.theme = id;
      save();
    }
    this.theme = persist ? currentTheme() : themeById(id);
    this.sfx.theme = this.theme;
    this.scene.setTheme(this.theme);
    this.r3?.setTheme(this.theme);
    this.applyTheme();
  }

  /** Redesenează ecranul (fără tranziție). */
  private showScreen(fn: () => HTMLElement): void {
    this.screen = fn;
    this.sayEl = null;
    this.overlay.replaceChildren(fn());
    show(this.overlay, true);
  }

  /** Navigare obișnuită: banda de cerneală trece peste ecran, pagina se schimbă la jumătate. */
  private go(fn: () => HTMLElement): void {
    this.wipe(() => this.showScreen(fn));
  }

  private hideOverlay(): void {
    show(this.overlay, false);
    this.overlay.replaceChildren();
    this.sayEl = null;
  }

  private page(cls: string, ...kids: (Node | string | null | false | undefined)[]): HTMLElement {
    return h('div', { class: 'page ' + cls }, ...kids);
  }

  /** Personajul mare al ecranului (cel care reacționează), pe panou cyan cu raze și balon. */
  private heroBox(
    cls: string,
    spec: { ch: string; outfit: Outfit | null; color?: string; bomb?: boolean },
    line: string | null,
    ...extra: (Node | null | false)[]
  ): HTMLElement {
    const say_ = line !== null ? say(line) : null;
    this.sayEl = say_;
    return panel('cyan hero-box ' + cls, rays(), say_, this.portraits.add({ ...spec, lead: true }), ...extra);
  }

  /** Reacția personajului mare: expresie + replică în balon, apoi înapoi în repaus. */
  private react(kind: 'fight' | 'joy' | 'sad' | 'mute' | 'unmute', text?: string): void {
    const c = charById(this.playCh());
    const expr = kind === 'fight' ? 'fierce' : kind === 'joy' || kind === 'unmute' ? 'happy' : 'doom';
    const line =
      text ??
      (kind === 'fight'
        ? this.line(MENU_LINES.fight)
        : kind === 'joy'
          ? this.line(c.win)
          : kind === 'sad'
            ? this.line(c.quips)
            : kind === 'mute'
              ? MENU_LINES.mute
              : MENU_LINES.unmute);
    const ms = kind === 'mute' ? 800 : 1300;
    this.portraits.react(expr, ms);
    const el = this.sayEl;
    if (!el || !el.isConnected) return;
    const before = el.textContent;
    el.textContent = line;
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => {
      if (el.isConnected && el.textContent === line) el.textContent = before;
    }, ms + 600);
  }

  /** O replică din listă, fără s-o repete imediat pe ultima. */
  private line(list: readonly string[]): string {
    const opts = list.length > 1 ? list.filter((l) => l !== this.lastLine) : list;
    this.lastLine = pickOne(opts);
    return this.lastLine;
  }

  private backTo(to: () => HTMLElement = () => this.mainMenu()): () => void {
    return () => this.go(to);
  }

  /* ---------- ecrane ---------- */

  private mainMenu(): HTMLElement {
    const season = seasonalTheme(now());
    const p = store.profile;
    const ch = charById(this.playCh());
    const lv = levelOf(p.xp[ch.id] ?? 0).level;
    const pl = playerLevel(totalXp(p));
    return this.page(
      'home',
      h(
        'div',
        { class: 'head' },
        h(
          'div',
          { class: 'plevel', 'data-test': 'player-level' },
          h('b', {}, `Player Lv ${pl.level}`),
          h('i', { style: `--w:${pl.need ? Math.round((pl.into / pl.need) * 100) : 100}%` }),
          h('small', {}, pl.need ? `${pl.into}/${pl.need} XP` : 'MAX'),
        ),
        caption(season ? `Meanwhile, in the arena… it’s ${season.name} season!` : 'Meanwhile, in the arena…'),
        h('div', { class: 'push' }),
        coins(p.coins),
        sq(icon.gear(), 'Settings', () => this.go(() => this.settingsMenu()), { 'data-test': 'settings' }),
      ),
      h(
        'div',
        { class: 'body' },
        this.heroBox(
          'tl',
          { ch: ch.id, outfit: p.eq },
          this.line(MENU_LINES.idle),
          h(
            'button',
            { class: 'foot', 'data-test': 'characters', onclick: () => this.go(() => this.charactersMenu()) },
            `${ch.name} · Lv ${lv} · Characters`,
          ),
          this.newBadge('char'),
        ),
        h(
          'div',
          { class: 'col grow' },
          h(
            'div',
            { class: 'playbox' },
            h(
              'button',
              {
                class: 'play',
                'data-test': 'play',
                'data-fx': 'main',
                onclick: () => {
                  this.react('fight');
                  this.go(() => this.playMenu());
                },
              },
              'PLAY!',
            ),
            this.newBadge('mode'),
            !OFFLINE_ONLY &&
              h(
                'button',
                { class: 'online', 'data-test': 'online', onclick: () => this.go(() => this.onlineMenu()) },
                h('b', {}, 'ONLINE'),
                h('small', {}, 'quick play · private rooms'),
              ),
          ),
          h(
            'div',
            { class: 'tiles' },
            h(
              'button',
              { class: 'tile', 'data-test': 'shop', onclick: () => this.go(() => this.shopMenu('color')) },
              'SHOP',
            ),
            h(
              'button',
              { class: 'tile', 'data-test': 'missions', onclick: () => this.go(() => this.missionsMenu()) },
              'MISSIONS',
            ),
            h(
              'button',
              { class: 'tile', 'data-test': 'practice', onclick: () => this.go(() => this.practiceMenu()) },
              'PRACTICE',
            ),
            h(
              'button',
              { class: 'tile', 'data-test': 'themes', onclick: () => this.go(() => this.themesMenu()) },
              'THEMES',
              this.newBadge('theme'),
            ),
          ),
          DEV_TOOLS &&
            btn('sec', `DEV · ${store.label}${store.admin ? ' (admin)' : ''}`, () => void this.openDev(), {
              class: 'dev-btn',
              'data-test': 'dev',
            }),
        ),
      ),
    );
  }

  private missionsMenu(): HTMLElement {
    const stars = settings.stars;
    const starStr = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
    return this.page(
      'missions',
      head(
        'MISSIONS',
        this.backTo(),
        caption('Solo, with a health bar. Stars for time and health left.', undefined, 'push'),
      ),
      ...CHAPTERS.map((c, ci) => {
        const open = chapterUnlocked(ci, stars);
        const got = c.missions.reduce((n, id) => n + (stars[id] ?? 0), 0);
        return h(
          'section',
          { class: 'chapter' },
          h(
            'h2',
            { class: 'sub-title' + (open ? '' : ' paper') },
            `${c.name} · ${got}/${c.missions.length * 3}★`,
          ),
          open
            ? h(
                'div',
                { class: 'cards', style: '--cols:4' },
                ...c.missions.map((id) => {
                  const def = missionById(id)!;
                  const ok = missionUnlocked(id, stars);
                  return lock(
                    h(
                      'button',
                      {
                        class: 'card',
                        'data-mission': id,
                        'data-fx': 'main',
                        title: def.desc,
                        'data-why': 'Win the one before first!',
                        onclick: () => this.start({ type: 'mission', id }),
                      },
                      h('b', {}, def.name),
                      h('small', { class: 'stars' }, ok ? starStr(stars[id] ?? 0) : 'Locked'),
                    ),
                    !ok,
                  );
                }),
              )
            : caption(`Unlocks with ${c.unlockStars}★ in the previous chapter.`, 'Locked:'),
        );
      }),
    );
  }

  /** `gated = false`: Online (jocul rapid) nu ține cont de nivelul jucătorului (D-040). */
  private modeGrid(cur: ModeId | null, onPick: (m: ModeId) => void, gated = true): HTMLElement {
    const a = { ...store.access(), admin: store.admin || !gated };
    const seen = store.profile.seen;
    return h(
      'div',
      { class: 'cards' },
      ...MODE_IDS.map((m) => {
        const lk = modeLock(m, a);
        const on = m === cur;
        return lock(
          h(
            'button',
            {
              class: 'card',
              'aria-pressed': String(on),
              'data-mode': m,
              'data-why': lk?.kind === 'level' ? `Not yet. Level ${lk.level}.` : undefined,
              onclick: () => onPick(m),
            },
            h('b', {}, MODES[m].name),
            h(
              'small',
              { class: lk ? 'lock-txt' : '' },
              lk?.kind === 'level' ? `Player Lv ${lk.level}` : firstSentence(MODES[m].desc),
            ),
            on ? tag('PICKED!', 'picked') : null,
            !lk && !on && !seen.includes(`mode:${m}`) ? tag('NEW', 'new ok') : null,
          ),
          !!lk,
        );
      }),
    );
  }

  private botsSeg(cur: BotLevel | undefined, pick: (l: BotLevel) => void, disabled = false): HTMLElement {
    return seg(
      'Bot difficulty',
      LEVELS.map((l) => [l, BOT_NAMES[l]] as const),
      cur,
      pick,
      'data-level',
      disabled,
    );
  }

  /** Butonul cu personajul curent și Ultimate-ul lui (deschide grila de personaje). `back` = ecranul la care revii. */
  private charButton(back: () => HTMLElement, slim = false): HTMLElement {
    const c = charById(this.playCh());
    const aff = affinity(c.id, this.theme.id);
    return h(
      'button',
      {
        class: 'pick-btn' + (slim ? ' slim' : ''),
        'data-test': 'hero',
        style: `--hc:${lookColor(c.id, store.profile.eq)}`,
        onclick: () => this.go(() => this.charactersMenu(back)),
      },
      h('i', { class: 'dot' }),
      slim
        ? h('span', {}, h('b', {}, c.name))
        : h(
            'span',
            {},
            h('b', {}, `${c.name} — ${c.ultimate.name}`),
            h('small', {}, aff ? aff.text : 'change character'),
          ),
    );
  }

  private playMenu(): HTMLElement {
    if (this.kind.type !== 'mode' || modeLock(this.kind.mode, store.access()))
      this.kind = { type: 'mode', mode: modeLock(settings.mode, store.access()) ? 'ffa' : settings.mode };
    queueMicrotask(() => this.seeAll('mode'));
    const mode = this.kind.mode;
    const re = () => this.showScreen(() => this.playMenu());
    return this.page(
      'play',
      head('CHOOSE A MODE', this.backTo(), caption(MODES[mode].desc, `${MODES[mode].name}:`, 'push')),
      h(
        'div',
        { class: 'body' },
        h(
          'div',
          { class: 'grow' },
          this.modeGrid(mode, (m) => {
            this.kind = { type: 'mode', mode: m };
            settings.mode = m;
            save();
            re();
          }),
        ),
        h(
          'div',
          { class: 'col', style: 'width:250px;flex:none' },
          !settings.classic && this.charButton(() => this.playMenu()),
          h(
            'div',
            {},
            h('div', { class: 'label' }, 'Rules'),
            seg(
              'Rules',
              [
                ['true', 'Classic'],
                ['false', 'Characters'],
              ] as const,
              String(settings.classic) as 'true' | 'false',
              (v) => {
                settings.classic = v === 'true';
                save();
                re();
              },
              'data-classic',
            ),
          ),
          h(
            'div',
            {},
            h('div', { class: 'label' }, 'Bots'),
            this.botsSeg(settings.bots, (l) => {
              settings.bots = l;
              save();
              re();
            }),
          ),
          h('div', { class: 'grow' }),
          btn('cyan', 'INFINITE WORLD', () => this.start({ type: 'infinite' }), {
            'data-test': 'infinite',
            title: 'Endless map, bots everywhere, they get tougher the farther you go',
          }),
          btn('main', 'START!', () => this.start({ type: 'mode', mode }), {
            class: 'huge',
            'data-test': 'start',
          }),
        ),
      ),
    );
  }

  /* ---------- online ---------- */

  private onlineMenu(): HTMLElement {
    const name = h('input', {
      class: 'field',
      'data-test': 'name',
      maxlength: 12,
      placeholder: 'Your name',
      value: settings.name,
      autocomplete: 'nickname',
      style: 'width:150px',
    });
    const code = h('input', {
      class: 'field code grow',
      'data-test': 'code',
      'aria-label': 'Room code',
      maxlength: 4,
      placeholder: 'CODE',
      autocapitalize: 'characters',
      autocomplete: 'off',
    });
    const go = async (make: () => Promise<OnlineSession>) => {
      settings.name = name.value.trim().slice(0, 12);
      save();
      this.onlineErr = '';
      try {
        this.enterRoom(await make());
      } catch (e) {
        this.onlineErr = e instanceof Error && e.message ? e.message : 'Could not connect to the server.';
        this.react('sad');
        this.showScreen(() => this.onlineMenu());
      }
    };
    const quickMode = this.kind.type === 'mode' ? this.kind.mode : settings.mode;
    return this.page(
      'online',
      head(
        'ONLINE',
        this.backTo(),
        h(
          'label',
          { class: 'push label', style: 'display:flex;align-items:center;gap:8px;margin:0' },
          'Your name',
          name,
        ),
        this.charButton(() => this.onlineMenu(), true),
      ),
      this.onlineErr && h('p', { class: 'err', role: 'alert' }, this.onlineErr),
      h(
        'div',
        { class: 'body', style: 'gap:22px' },
        panel(
          'tl grow col',
          h('h2', { class: 'sub-title' }, 'QUICK PLAY'),
          h('div', { style: 'font-size:13px' }, 'Jump into a public match. Bots fill the empty seats.'),
          h(
            'div',
            { class: 'seg qmodes', role: 'group', 'aria-label': 'Quick play mode' },
            ...MODE_IDS.map((m) =>
              h(
                'button',
                {
                  'data-mode': m,
                  'aria-pressed': String(m === quickMode),
                  onclick: () => {
                    this.kind = { type: 'mode', mode: m };
                    settings.mode = m;
                    save();
                    this.showScreen(() => this.onlineMenu());
                  },
                },
                MODES[m].name,
              ),
            ),
          ),
          h('div', { class: 'grow' }),
          h(
            'div',
            { style: 'display:flex;gap:10px' },
            btn(
              'main',
              'QUICK PLAY!',
              () => go(() => OnlineSession.quick(quickMode, this.meMsg(name.value), this.aspect())),
              {
                'data-test': 'quick',
                class: 'grow',
              },
            ),
            btn('cyan', 'INFINITE WORLD', () => void this.goInfinite(name.value), {
              'data-test': 'inf-online',
              title: 'One endless map for up to 80 players. Drop in, drop out.',
            }),
          ),
        ),
        panel(
          'tr col side',
          h('h2', { class: 'sub-title paper' }, 'PRIVATE ROOM'),
          btn('cyan', 'CREATE A ROOM', () => go(() => OnlineSession.create(this.meMsg(name.value))), {
            'data-test': 'create',
            style: 'min-height:56px;font-size:26px',
          }),
          h('div', { class: 'or' }, 'OR JOIN WITH A CODE'),
          h('div', { class: 'grow' }),
          h(
            'div',
            { style: 'display:flex;gap:10px' },
            code,
            btn(
              'sec',
              'JOIN',
              () => {
                if (/^[a-z]{4}$/i.test(code.value))
                  void go(() => OnlineSession.join(code.value, this.meMsg(name.value)));
                else this.react('sad', 'Four letters, please.');
              },
              { 'data-test': 'join', style: 'width:100px;min-height:56px;font-size:26px' },
            ),
          ),
        ),
      ),
    );
  }

  private enterRoom(o: OnlineSession): void {
    this.online = o;
    o.net.onLobby = () => {
      if (this.online === o && this.phase === 'menu' && !this.match && !this.sheetOpen)
        this.showScreen(() => this.lobbyScreen());
    };
    o.net.onSnap = () => {
      if (this.online === o && this.match?.net !== o.net) this.startOnline(o);
    };
    o.onOutcome = (r) => {
      this.adopt(r.profile);
      if (r.trophyDelta !== 0)
        this.showBanner(
          `${r.trophyDelta > 0 ? '+' : ''}${r.trophyDelta} trophies · ${r.trophies} with ${charById(r.ch ?? 'bubu').name}`,
          3200,
          r.trophyDelta > 0 ? 'gold' : 'bad',
        );
    };
    o.onStatus = (st, reason) => {
      if (this.online !== o) return;
      if (st === 'reconnecting') this.connLost();
      if (st === 'online') {
        this.connBack();
        this.showBanner('Reconnected', 1400);
      }
      if (st === 'closed') {
        this.online = null;
        this.onlineErr = reason && !/consent/i.test(reason) ? reason : 'Disconnected from the room.';
        const inMatch = this.match !== null;
        this.toMenu();
        if (inMatch) this.connFailed();
        else this.showScreen(() => this.onlineMenu());
      }
    };
    this.go(() => this.lobbyScreen());
  }

  /* ---------- Infinit online ---------- */

  private async goInfinite(name: string): Promise<void> {
    settings.name = name.trim().slice(0, 12);
    save();
    this.onlineErr = '';
    try {
      this.enterInfinite(await InfiniteSession.join(this.meMsg(settings.name)));
    } catch (e) {
      this.onlineErr = e instanceof Error && e.message ? e.message : 'Could not connect to the server.';
      this.react('sad');
      this.showScreen(() => this.onlineMenu());
    }
  }

  private enterInfinite(o: InfiniteSession): void {
    if (this.online) this.leaveOnline();
    this.inf = o;
    // bun venit (și după reconectare): oglinda e nouă, meciul o citește prin `net.view`
    o.view.onWelcome = () => {
      if (this.inf === o && this.match?.net !== o.view) this.startInfinite(o);
    };
    o.view.onBoard = (b) => {
      if (this.inf !== o) return;
      const s = o.view.view;
      // liderul poartă coroana (doar în oglindă, ca să se vadă: cine e sus e ținta tuturor)
      const lead = b.top[0];
      if (s) s.crown = b.n > 1 && lead && lead[1] > 0 ? { x: 0, y: 0, holder: lead[0], need: 1 } : null;
      this.renderBoard();
    };
    o.onStatus = (st, reason) => {
      if (this.inf !== o) return;
      if (st === 'reconnecting') this.connLost();
      if (st === 'online') {
        this.connBack();
        this.showBanner('Reconnected', 1400);
      }
      if (st === 'closed') {
        this.inf = null;
        this.onlineErr = reason && !/consent/i.test(reason) ? reason : 'Disconnected from the world.';
        const inMatch = this.match !== null;
        this.toMenu();
        if (inMatch) this.connFailed();
        else this.showScreen(() => this.onlineMenu());
      }
    };
  }

  private startInfinite(o: InfiniteSession): void {
    const v = o.view;
    if (!v.view || v.me < 0) return;
    this.setTheme(v.theme, false);
    this.beginPlay();
    const kind: PlayKind = { type: 'infinite' };
    this.kind = kind;
    const m = new Match(
      kind,
      'normal',
      { s: v.view, slots: v.slots, tutorial: null },
      this.control(),
      v.me,
      v,
    );
    this.scores = [];
    this.attach(m);
    this.boom();
    this.showBanner('Infinite world · go far, break boxes, stay alive!', 2600, 'gold');
  }

  private leaveInf(): void {
    const o = this.inf;
    this.inf = null;
    o?.leave();
    if (this.theme.id !== currentTheme().id) this.setTheme(currentTheme().id, false);
  }

  /** Clasamentul top 10 (online): tu evidențiat, iar dacă nu ești în top, pe ultimul rând. */
  private renderBoard(): void {
    const b = this.inf?.view.board;
    const m = this.match;
    if (!b || !m) {
      this.board.replaceChildren();
      return;
    }
    const row = (rank: number, id: number, score: number, cls = '') =>
      h(
        'li',
        { class: cls || undefined },
        h('b', {}, rank === 1 ? '♛' : String(rank)),
        h('i', { style: `background:${m.slots[id]?.color ?? '#fff'}` }),
        h('span', {}, id === m.meId ? 'YOU' : (m.slots[id]?.name ?? '?')),
        h('em', {}, String(score)),
      );
    const rows = b.top.map(([id, score], i) => row(i + 1, id, score, id === m.meId ? 'me' : ''));
    if (!b.top.some(([id]) => id === m.meId)) rows.push(row(b.you[0], m.meId, b.you[1], 'me sep'));
    this.board.replaceChildren(...rows);
  }

  /** Minimapa: tu în centru; online liderii (♛) și cine e în jur, offline boții. Scara se adaptează. */
  private drawMini(): void {
    const m = this.match;
    const c = this.mini.getContext('2d');
    if (!m || !c) return;
    const s = m.s;
    const me = m.me;
    const mx = me.px / U;
    const my = me.py / U;
    const pts: { x: number; y: number; col: string; lead: boolean }[] = [];
    const b = this.inf?.view.board;
    const seen = new Set<number>();
    for (const [id, x, y] of b?.map ?? [])
      if (id !== m.meId) {
        seen.add(id);
        pts.push({ x, y, col: m.slots[id]?.color ?? '#fff', lead: b!.top[0]?.[0] === id });
      }
    for (const p of s.players)
      if (p.id !== m.meId && p.alive && !p.out && !seen.has(p.id))
        pts.push({
          x: p.px / U,
          y: p.py / U,
          col: p.bot !== null ? '#e5262b' : (m.slots[p.id]?.color ?? '#fff'),
          lead: false,
        });
    const far = Math.max(0, ...pts.map((p) => Math.hypot(p.x - mx, p.y - my)));
    const R = Math.min(600, Math.max(24, far * 1.15));
    const W = this.mini.width;
    const k = W / 2 / R;
    const at = (x: number, y: number): [number, number] => [W / 2 + (x - mx) * k, W / 2 + (y - my) * k];
    c.clearRect(0, 0, W, W);
    c.strokeStyle = 'rgba(17,17,17,0.25)';
    c.lineWidth = 1;
    for (const r of [0.5, 1]) {
      c.beginPath();
      c.arc(W / 2, W / 2, (W / 2) * r - 2, 0, Math.PI * 2);
      c.stroke();
    }
    // centrul lumii
    const [ox, oy] = at(1, 1);
    if (ox > 0 && oy > 0 && ox < W && oy < W) {
      c.strokeStyle = '#111';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ox - 4, oy - 4);
      c.lineTo(ox + 4, oy + 4);
      c.moveTo(ox + 4, oy - 4);
      c.lineTo(ox - 4, oy + 4);
      c.stroke();
    }
    for (const p of pts) {
      const [x, y] = at(p.x, p.y);
      if (x < 0 || y < 0 || x > W || y > W) continue;
      c.fillStyle = p.col;
      c.strokeStyle = '#111';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, y, p.lead ? 5 : 3.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (p.lead) {
        c.fillStyle = '#111';
        c.font = '12px sans-serif';
        c.fillText('♛', x - 6, y - 7);
      }
    }
    c.fillStyle = '#ffd60a';
    c.strokeStyle = '#111';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(W / 2, W / 2, 5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#111';
    c.font = '10px sans-serif';
    c.fillText(`${Math.round(R)} m`, 4, W - 5);
  }

  /** Ecranul „Connection lost” (panoul cade în ecran, notă coborâtoare); meciul merge mai departe. */
  private connLost(): void {
    this.sfx.ui('down');
    vibrate([40, 80, 40]);
    const t0 = performance.now();
    const fill = h('i', { style: 'width:100%' });
    const left = h('span', {}, '15s left');
    this.conn.replaceChildren(
      h(
        'div',
        { class: 'modal' },
        h(
          'div',
          { class: 'mpanel', role: 'alertdialog', 'aria-label': 'Connection lost' },
          caption('Suddenly, somewhere in the tubes…'),
          this.sideHero(MENU_LINES.lost, 'doom'),
          h(
            'div',
            { class: 'col grow' },
            h('h1', { class: 'ptitle' }, 'CONNECTION LOST'),
            h(
              'div',
              {},
              'The match keeps going without you. Your character stands still until you are back.',
            ),
            h(
              'div',
              {},
              h(
                'div',
                { class: 'label', style: 'display:flex;justify-content:space-between' },
                h('span', {}, 'Reconnecting…'),
                left,
              ),
              h('div', { class: 'hbar' }, fill),
            ),
            h('div', { class: 'grow' }),
            btn('sec', 'LEAVE MATCH', () => {
              this.connBack();
              this.toMenu();
            }),
          ),
        ),
      ),
    );
    show(this.conn, true);
    const tick = () => {
      if (this.conn.classList.contains('hidden') || !fill.isConnected) return;
      const s = Math.max(0, 15 - (performance.now() - t0) / 1000);
      fill.style.width = `${(s / 15) * 100}%`;
      left.textContent = `${Math.ceil(s)}s left`;
      if (s > 0) setTimeout(tick, 250);
    };
    tick();
  }

  private connBack(): void {
    show(this.conn, false);
    this.conn.replaceChildren();
  }

  /** „No way back”: reconectarea a eșuat în timpul meciului. */
  private connFailed(): void {
    this.sfx.ui('down');
    vibrate([40, 80, 40]);
    this.conn.replaceChildren(
      h(
        'div',
        { class: 'modal' },
        h(
          'div',
          { class: 'mpanel', role: 'alertdialog', 'aria-label': 'No way back' },
          caption('Suddenly, somewhere in the tubes…'),
          this.sideHero(MENU_LINES.lost, 'doom'),
          h(
            'div',
            { class: 'col grow' },
            h('h1', { class: 'ptitle' }, 'NO WAY BACK'),
            h('div', {}, this.onlineErr || 'We could not get you back in time.'),
            h('div', { class: 'grow' }),
            h(
              'div',
              { class: 'two' },
              btn('main', 'TRY AGAIN', () => {
                this.connBack();
                this.go(() => this.onlineMenu());
              }),
              btn('sec', 'MENU', () => {
                this.connBack();
                this.go(() => this.mainMenu());
              }),
            ),
          ),
        ),
      ),
    );
    show(this.conn, true);
  }

  /** Personajul din panourile modale (pauză, conexiune, rezultate). */
  private sideHero(line: string | null, expr: paint.Expr | null, cls = ''): HTMLElement {
    const p = store.profile;
    const box = h(
      'div',
      { class: 'hero-box ' + cls },
      line !== null ? say(line, cls === 'zzz' ? 'zzz' : '') : null,
      this.portraits.add({
        ch: this.playCh(),
        outfit: p.eq,
        lead: true,
        react: expr ? { expr, until: performance.now() + 1e9 } : undefined,
      }),
    );
    return box;
  }

  /** Foaia cu opțiunile unei reguli din cameră (doar gazda). */
  private openSheet(title: string, body: HTMLElement): void {
    this.sheetOpen = true;
    const close = () => {
      this.sheetOpen = false;
      sheet.remove();
      if (this.phase === 'menu' && this.online) this.showScreen(() => this.lobbyScreen());
    };
    const sheet: HTMLElement = h(
      'div',
      { class: 'sheet', onclick: (e: Event) => e.target === sheet && close() },
      panel(
        'col',
        h('div', { class: 'head' }, sq(icon.back(), 'Close', close), h('h1', { class: 'ptitle' }, title)),
        body,
      ),
    );
    body.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) setTimeout(close, 120);
    });
    this.overlay.append(sheet);
  }

  private lobbyScreen(): HTMLElement {
    const o = this.online;
    if (!o) return this.onlineMenu();
    const l = o.net.lobby;
    const host = o.isHost;
    const cfg = l?.cfg;
    const quick = !!l?.quick;
    const seats = l?.seats ?? [];
    const max = l?.max ?? 4;
    const SEAT_BG = ['#19B5E8', '#FFD60A', '#E5262B', '#C79BFF', '#5BE36A', '#FF8A3D'];
    const seatList = h(
      'ul',
      {
        class: 'seats',
        style: `grid-template-columns:repeat(${Math.min(6, Math.max(4, max))},minmax(0,1fr))`,
      },
      ...seats.map((st, i) =>
        h(
          'li',
          { class: st.connected ? '' : 'off', style: `--sb:${SEAT_BG[i % SEAT_BG.length]}` },
          this.portraits.add({ ch: st.ch, outfit: st.sid === o.room.sessionId ? store.profile.eq : null }),
          h(
            'div',
            { class: 'nm' },
            h('b', {}, st.name),
            h(
              'small',
              {},
              [
                i === 0 && !quick ? 'host' : '',
                st.sid === o.room.sessionId ? 'you' : '',
                cfg && !cfg.classic ? charById(st.ch).name : '',
              ]
                .filter(Boolean)
                .join(' · '),
            ),
          ),
        ),
      ),
      ...Array.from({ length: Math.max(0, max - seats.length) }, () =>
        h(
          'li',
          { class: 'empty' },
          h('div', { class: 'q' }, '?'),
          h('div', { class: 'nm' }, h('b', {}, quick ? 'Searching…' : 'Bot')),
        ),
      ),
    );
    const leave = () => {
      this.leaveOnline();
      this.go(() => this.onlineMenu());
    };
    const status = quick
      ? l?.startIn != null
        ? `Starting in ${l.startIn}s… Bots fill the empty seats.`
        : 'Waiting for players…'
      : host
        ? 'Share the code with your friends, then press Start.'
        : 'Waiting for the host to start…';
    if (quick)
      return this.page(
        'lobby quick',
        head(
          `QUICK PLAY: ${cfg ? MODES[cfg.mode].name.toUpperCase() : ''}`,
          null,
          caption('Somewhere, strangers are lacing up…', undefined, 'push'),
        ),
        seatList,
        h(
          'div',
          { style: 'display:flex;align-items:center;gap:16px' },
          caption(status, undefined, 'grow info'),
          l?.startIn != null ? h('div', { class: 'countdown' }, String(l.startIn)) : null,
          btn('sec', 'LEAVE', leave, { style: 'width:150px;min-height:56px;font-size:26px' }),
        ),
        h('span', { 'data-test': 'lobby-status', class: 'hidden' }, status),
      );
    const share = async () => {
      const text = `Join my Fuse Arena room: ${o.code}`;
      try {
        if (navigator.share) await navigator.share({ text });
        else await navigator.clipboard.writeText(o.code);
        this.showBanner('Code copied!', 1200);
      } catch {
        /* anulat */
      }
    };
    const row = (key: string, label: string, value: string, open: () => void) =>
      h(
        'button',
        { 'data-rule': key, disabled: !host, onclick: open },
        h('small', {}, label),
        h('b', {}, value),
        icon.next(),
      );
    const cards = (
      attr: string,
      items: readonly string[],
      cur: string | undefined,
      name: (v: string) => string,
      set: (v: string) => void,
    ) =>
      h(
        'div',
        { class: 'cards' },
        ...items.map((v) =>
          h(
            'button',
            { class: 'card', [attr]: v, 'aria-pressed': String(v === cur), onclick: () => set(v) },
            h('b', {}, name(v)),
          ),
        ),
      );
    return this.page(
      'lobby',
      head(
        'ROOM',
        leave,
        h('span', { class: 'room-code', 'data-test': 'room-code' }, o.code),
        btn('cyan', 'SHARE', () => void share(), { style: 'transform:none' }),
        caption(status, undefined, 'push'),
      ),
      h('span', { 'data-test': 'lobby-status', class: 'hidden' }, status),
      h(
        'div',
        { class: 'body' },
        h(
          'div',
          { class: 'col grow' },
          seatList,
          !!cfg &&
            seats.length > max &&
            h('p', { class: 'err' }, `${MODES[cfg.mode].name} takes only ${max} players.`),
          h(
            'div',
            { style: 'display:flex;gap:12px' },
            cfg && !cfg.classic
              ? btn(
                  'sec',
                  `YOUR CHARACTER: ${charById(store.profile.ch).name.toUpperCase()}`,
                  () => this.go(() => this.charactersMenu(() => this.lobbyScreen())),
                  {
                    class: 'grow',
                    'data-test': 'lobby-char',
                  },
                )
              : h('div', { class: 'grow' }),
            btn('sec', 'LEAVE ROOM', leave, { style: 'width:150px' }),
          ),
        ),
        h(
          'div',
          { class: 'col', style: 'width:250px;flex:none' },
          panel(
            'tr rules',
            row('mode', 'MODE', cfg ? MODES[cfg.mode].name : '…', () =>
              this.openSheet(
                'MODE',
                cards(
                  'data-mode',
                  MODE_IDS,
                  cfg?.mode,
                  (v) => MODES[v as ModeId].name,
                  (v) => o.setCfg({ mode: v as ModeId }),
                ),
              ),
            ),
            row('rules', 'RULES', cfg?.classic ? 'Classic' : 'Characters', () =>
              this.openSheet(
                'RULES',
                cards(
                  'data-classic',
                  ['false', 'true'],
                  String(!!cfg?.classic),
                  (v) => (v === 'true' ? 'Classic' : 'Characters'),
                  (v) => o.setCfg({ classic: v === 'true' }),
                ),
              ),
            ),
            row('bots', 'BOTS', cfg ? BOT_NAMES[cfg.bots] : '…', () =>
              this.openSheet(
                'BOTS',
                cards(
                  'data-level',
                  LEVELS,
                  cfg?.bots,
                  (v) => BOT_NAMES[v as BotLevel],
                  (v) => o.setCfg({ bots: v as BotLevel }),
                ),
              ),
            ),
            row('theme', 'THEME', cfg ? themeById(cfg.theme).name : '…', () =>
              this.openSheet(
                'THEME',
                cards(
                  'data-theme',
                  THEMES.map((t) => t.id),
                  cfg?.theme,
                  (v) => themeById(v).name,
                  (v) => o.setCfg({ theme: v }),
                ),
              ),
            ),
            !cfg?.classic &&
              row('extras', 'EVENTS', cfg?.extras === false ? 'Off' : 'On', () =>
                this.openSheet(
                  'ARENA EVENTS & NEW POWER-UPS',
                  cards(
                    'data-extras',
                    ['on', 'off'],
                    cfg?.extras === false ? 'off' : 'on',
                    (v) => (v === 'on' ? 'On' : 'Off'),
                    (v) => o.setCfg({ extras: v === 'on' }),
                  ),
                ),
              ),
          ),
          h('div', { class: 'grow' }),
          host &&
            btn('main', 'START!', () => o.start(this.aspect()), { class: 'huge', 'data-test': 'start' }),
        ),
      ),
    );
  }

  private leaveOnline(): void {
    const o = this.online;
    this.online = null;
    o?.leave();
    if (this.theme.id !== currentTheme().id) this.setTheme(currentTheme().id, false);
  }

  /** Pornește (sau repornește) meciul online din starea primită de la server. */
  private startOnline(o: OnlineSession): void {
    const net = o.net;
    if (!net.view || !net.cfg) return;
    if (net.me < 0) return;
    this.setTheme(net.cfg.theme, false);
    this.beginPlay();
    const kind: PlayKind = { type: 'mode', mode: net.cfg.mode };
    this.kind = kind;
    const m = new Match(
      kind,
      net.cfg.bots,
      { s: net.view, slots: net.slots, tutorial: null },
      this.control(),
      net.me,
      net,
    );
    this.scores = m.team ? [0, 0] : m.slots.map(() => 0);
    this.attach(m);
    // online meciul pornește pe ceasul serverului: doar explozia, fără numărătoare
    this.boom();
    this.startBanners(m.s);
    if (o.lag)
      this.showBanner(
        `Simulated lag ${o.lag.rtt} ms ±${o.lag.jitter}, loss ${Math.round(o.lag.loss * 100)}%`,
        2600,
      );
  }

  /** Panoul DEV (doar în build-urile interne; modulul lipsește din build-ul public). */
  private async openDev(): Promise<void> {
    // condiția e constantă la compilare: în build-ul public importul (și modulul) dispar
    if (!__DEV_TOOLS__) return;
    const { devScreen } = await import('./dev/panel.ts');
    const open = (): HTMLElement =>
      devScreen({
        back: () => {
          this.theme = this.allowedTheme();
          this.setTheme(this.theme.id, false);
          this.showScreen(() => this.mainMenu());
        },
        rerender: () => this.showScreen(open),
        sfx: this.sfx,
      });
    this.go(open);
  }

  /* ---------- personaje, magazin, recompense ---------- */

  private meMsg(name: string) {
    return { name, ch: this.playCh(), outfit: store.profile.eq };
  }

  /**
   * Profilul de pe server devine cel local (D-067). Insignele „NEW” (`seen`) rămân locale. Profilurile de test
   * din panoul DEV nu se ating.
   */
  private adopt(p: Profile): void {
    if (store.active) return;
    store.set({ ...p, seen: store.real.seen });
    this.online?.setMe({ ch: p.ch, outfit: p.eq });
  }

  /** Schimbă profilul: imediat pe ecran (optimist), apoi serverul confirmă sau aduce înapoi starea lui. */
  private commit(p: Profile, ...ops: Op[]): void {
    store.set(p);
    this.online?.setMe({ ch: p.ch, outfit: p.eq });
    if (!account.linked || store.active || !ops.length) return;
    account.enqueue(
      ops,
      (q) => this.adopt(q),
      (why) => this.showBanner(why, 3200, 'bad'),
    );
  }

  private rarityChip(r: keyof typeof RARITY): HTMLElement {
    return h('span', { class: 'rar', style: `--rar:${RARITY[r].color}` }, RARITY[r].name);
  }

  /** Grila de personaje. `back` = unde te întorci (meniul principal sau lobby-ul online). */
  private charactersMenu(back: () => HTMLElement = () => this.mainMenu()): HTMLElement {
    queueMicrotask(() => this.seeAll('char'));
    const p = store.profile;
    const pick = this.castPick && charById(this.castPick).id === this.castPick ? this.castPick : p.ch;
    const sel = charById(pick);
    const selSt = charState(p, sel.id, store.access());
    const self = () => this.charactersMenu(back);
    const open = () => this.go(() => this.characterPage(sel.id, self));
    return this.page(
      'cast-page',
      head(
        'THE CAST',
        () => {
          this.castPick = null;
          this.go(back);
        },
        h('div', { class: 'push' }),
        coins(p.coins),
      ),
      h(
        'div',
        { class: 'cards cast' },
        ...CHARACTERS.map((c) => {
          const st = charState(p, c.id, store.access());
          const own = st.kind === 'owned' || st.kind === 'rotation';
          const soon = st.kind === 'soon';
          const lv = levelOf(p.xp[c.id] ?? 0).level;
          return h(
            'button',
            {
              class: 'ccard' + (own ? '' : ' dim'),
              'data-char': c.id,
              'aria-pressed': String(pick === c.id),
              'aria-label': soon ? 'Coming soon' : c.name,
              style: `--rar:${RARITY[c.rarity].color}`,
              onclick: () => {
                if (pick === c.id) return this.go(() => this.characterPage(c.id, self));
                this.castPick = c.id;
                this.showScreen(self);
              },
            },
            this.portraits.add(
              soon
                ? { ch: c.id, outfit: null, color: '#0b0d16' }
                : { ch: c.id, outfit: p.ch === c.id ? p.eq : null },
            ),
            h(
              'span',
              { class: 'nm' },
              h('b', {}, soon ? '???' : c.name),
              h(
                'small',
                { class: st.kind === 'rotation' ? 'hot' : '' },
                p.ch === c.id
                  ? `Selected · Lv ${lv}`
                  : st.kind === 'owned'
                    ? `Lv ${lv}`
                    : st.kind === 'rotation'
                      ? 'Free this week'
                      : st.kind === 'soon'
                        ? `Coming in ${st.days} day${st.days === 1 ? '' : 's'}`
                        : st.kind === 'level'
                          ? `Player Lv ${st.level}`
                          : `${charPrice(c)} Fitile`,
              ),
            ),
            !soon && !p.seen.includes(`char:${c.id}`) && own ? tag('NEW', 'new ok') : null,
          );
        }),
        h('div', { class: 'more-soon' }, 'MORE SOON…'),
      ),
      h(
        'div',
        { style: 'display:flex;gap:14px;align-items:stretch' },
        h(
          'div',
          {
            class: 'grow col pvbox',
          },
          h(
            'div',
            { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' },
            h(
              'b',
              { style: 'font:400 28px/1 var(--display);letter-spacing:1px' },
              selSt.kind === 'soon' ? '???' : sel.name,
            ),
            this.rarityChip(sel.rarity),
            selSt.kind !== 'soon' && h('i', { style: 'font-weight:500;font-size:13px' }, `“${sel.tagline}”`),
          ),
          h(
            'div',
            { style: 'font-size:13px;line-height:1.3' },
            h('b', {}, `Ultimate · ${selSt.kind === 'soon' ? '???' : sel.ultimate.name}: `),
            selSt.kind === 'soon' ? 'A secret, for now.' : sel.ultimate.desc,
          ),
        ),
        btn('main', 'OPEN PAGE', open, {
          'data-test': 'open-char',
          style: 'align-self:center;width:180px;min-height:60px;font-size:26px',
        }),
      ),
    );
  }

  /** Pagina unui personaj: aproape, cu vocea lui, plusuri/minusuri, nivel și recompense. */
  private characterPage(id: string, back: () => HTMLElement = () => this.charactersMenu()): HTMLElement {
    const c = charById(id);
    const p = store.profile;
    const st = charState(p, id, store.access());
    const own = st.kind === 'owned' || st.kind === 'rotation';
    const soon = st.kind === 'soon';
    const xp = p.xp[id] ?? 0;
    const lv = levelOf(xp);
    const listen = () => {
      this.sfx.init();
      this.sfx.voiceLine(c.voice);
      const line = pickOne([...c.win, ...c.quips]);
      this.portraits.react('happy', 1600);
      if (this.sayEl) this.sayEl.textContent = line;
      setTimeout(() => this.voice.say(line, 1.2), 450);
    };
    const refresh = () => this.showScreen(() => this.characterPage(id, back));
    type Stat = 'speed' | 'range' | 'maxBombs' | 'lives';
    const segs = (v: number, lo: number, hi: number) =>
      Math.max(1, Math.min(5, Math.round(((v - lo) / (hi - lo)) * 4) + 1));
    const bar = (label: string, k: Stat, lo: number, hi: number) => {
      const n = segs(c.kit[k], lo, hi);
      const a = segs(CHARACTERS.reduce((t, o) => t + o.kit[k], 0) / CHARACTERS.length, lo, hi);
      return [
        h('span', {}, label),
        h(
          'span',
          { class: 'sbar', title: 'the line marks the average' },
          ...[1, 2, 3, 4, 5].map((i) => h('i', { class: (i <= n ? 'on' : '') + (i === a ? ' avg' : '') })),
        ),
      ];
    };
    const price = charPrice(c);
    const ctaStyle = 'min-width:230px;min-height:60px;font-size:26px';
    const action = own
      ? p.ch === id
        ? btn('sec', 'SELECTED', null, { disabled: true, style: ctaStyle })
        : btn(
            'main',
            st.kind === 'rotation' ? 'PLAY FREE THIS WEEK' : 'SELECT',
            () => {
              const r = selectChar(store.profile, id, store.access());
              if (r.ok) this.commit(r.profile, { path: '/chars/select', body: { id } });
              this.sfx.init();
              this.sfx.voiceLine(c.voice);
              this.react('joy');
              setTimeout(() => this.go(back), 500);
            },
            { 'data-test': 'select-char', style: ctaStyle },
          )
      : soon
        ? btn('sec', `COMING ${st.date}`, null, { disabled: true, 'data-test': 'soon', style: ctaStyle })
        : st.kind === 'level'
          ? lock(
              btn('sec', `PLAYER LV ${st.level} · ${price} FITILE`, null, {
                'data-test': 'buy-char',
                'data-why': `Not yet. Level ${st.level}.`,
                style: ctaStyle,
              }),
              true,
            )
          : lock(
              btn(
                'main',
                `BUY FOR ${price} FITILE`,
                () => {
                  const r = buyChar(store.profile, id, store.access());
                  if (!r.ok) return;
                  const sel = selectChar(r.profile, id, store.access());
                  this.commit(
                    sel.ok ? sel.profile : r.profile,
                    { path: '/chars/buy', body: { id } },
                    { path: '/chars/select', body: { id } },
                  );
                  this.celebrate('buy');
                  refresh();
                  this.react('joy');
                },
                { 'data-test': 'buy-char', 'data-why': `You have ${p.coins} Fitile.`, style: ctaStyle },
              ),
              p.coins < price,
            );
    const note = own
      ? p.ch === id
        ? 'Selected. XP comes from matches, doubled for the first one each day.'
        : st.kind === 'rotation'
          ? 'Free this week. Buy it to keep it.'
          : 'Yours. Pick it for the next match.'
      : soon
        ? `Coming in ${st.days} day${st.days === 1 ? '' : 's'}.`
        : `You have ${p.coins} Fitile. Everything you unlock stays yours.`;
    const rw = levelRewards(id);
    const from = Math.max(0, Math.min(rw.length - 5, lv.level - 2));
    return this.page(
      'charpage',
      h(
        'div',
        { class: 'col' },
        this.heroBox(
          'tl2',
          soon ? { ch: id, outfit: null, color: '#0b0d16' } : { ch: id, outfit: p.ch === id ? p.eq : null },
          soon ? '…' : c.tagline,
        ),
        h(
          'div',
          { class: 'two', style: 'gap:12px' },
          btn('sec', 'LISTEN', listen, { 'data-test': 'listen', disabled: soon }),
          btn('cyan', 'TRY', () => this.start({ type: 'dummies', ch: id }), {
            'data-test': 'try',
            disabled: soon,
          }),
        ),
      ),
      h(
        'div',
        { class: 'col grow' },
        head(
          soon ? '???' : c.name.toUpperCase(),
          this.backTo(back),
          this.rarityChip(c.rarity),
          h('div', { class: 'push' }),
          coins(p.coins),
        ),
        caption(
          soon ? 'A secret, for now.' : c.ultimate.desc,
          `Ultimate · ${soon ? '???' : c.ultimate.name}:`,
        ),
        h(
          'div',
          {},
          h(
            'div',
            { class: 'label', style: 'display:flex;justify-content:space-between;text-transform:none' },
            h('span', {}, `Level ${lv.level}${lv.level >= MAX_LEVEL ? ' · Master' : ''}`),
            h('span', {}, lv.need ? `${lv.into}/${lv.need} XP` : `${xp} XP`),
          ),
          h(
            'div',
            { class: 'bar' },
            h('i', { style: `width:${lv.need ? Math.round((lv.into / lv.need) * 100) : 100}%` }),
          ),
        ),
        h(
          'div',
          { class: 'rewards' },
          ...rw
            .slice(from, from + 5)
            .map((r) =>
              h(
                'div',
                { class: r.level <= lv.level ? 'done' : '' },
                h('b', {}, `LV ${r.level}`),
                h(
                  'small',
                  {},
                  r.title ? `title “${r.title}”` : r.item ? shopItem(r.item)!.name : `+${r.coins} Fitile`,
                ),
              ),
            ),
        ),
        h(
          'div',
          { style: 'display:flex;align-items:center;gap:14px' },
          h('div', { class: 'grow', style: 'font-size:13px;line-height:1.3' }, note),
          action,
        ),
        !soon && caption(c.signature, 'Signature:'),
        !soon &&
          h(
            'div',
            { class: 'proscons' },
            h('ul', { class: 'pros' }, ...c.pros.map((t) => h('li', {}, t))),
            h('ul', { class: 'cons' }, ...c.cons.map((t) => h('li', {}, t))),
          ),
        !soon &&
          h(
            'div',
            { class: 'stats' },
            ...bar('Speed', 'speed', 135, 200),
            ...bar('Range', 'range', 1, 2),
            ...bar('Max bombs', 'maxBombs', 5, 8),
            ...bar('Lives', 'lives', 1, 2),
          ),
      ),
    );
  }

  private shopMenu(cat: ShopCat): HTMLElement {
    const p = store.profile;
    const refresh = () => this.showScreen(() => this.shopMenu(cat));
    const items = SHOP.filter(
      (i) => i.cat === cat && (!i.unlock || p.owned.includes(i.id) || i.unlock.char === p.ch),
    );
    const sel =
      items.find((i) => i.id === this.shopPick) ?? items.find((i) => p.eq[cat] === i.id) ?? items[0];
    const ch = this.playCh();
    const tryOn = sel && cat !== 'voice' && cat !== 'trail' ? { ...p.eq, [cat]: sel.id } : p.eq;
    const own = !!sel && p.owned.includes(sel.id);
    const worn = !!sel && p.eq[cat] === sel.id;
    const lockedBy = sel && !own && sel.unlock ? sel.unlock : null;
    const ctaStyle = 'min-width:210px;min-height:56px;font-size:24px';
    const cta = !sel
      ? null
      : worn
        ? btn(
            'sec',
            'TAKE IT OFF',
            () => {
              const e = equip(store.profile, cat, null);
              if (e.ok) this.commit(e.profile, { path: '/shop/equip', body: { cat, id: null } });
              refresh();
            },
            { 'data-test': 'shop-cta', style: ctaStyle },
          )
        : own
          ? btn(
              'sec',
              'WEAR IT',
              () => {
                const e = equip(store.profile, cat, sel.id);
                if (e.ok) this.commit(e.profile, { path: '/shop/equip', body: { cat, id: sel.id } });
                this.react('joy');
                refresh();
              },
              { 'data-test': 'shop-cta', style: ctaStyle },
            )
          : lockedBy
            ? lock(
                btn('sec', 'LOCKED', null, {
                  'data-test': 'shop-cta',
                  'data-why': `${charById(lockedBy.char).name} level ${lockedBy.level} first!`,
                  style: ctaStyle,
                }),
                true,
              )
            : lock(
                btn(
                  'main',
                  `BUY FOR ${sel.price} FITILE`,
                  () => {
                    const r = buyItem(store.profile, sel.id);
                    if (!r.ok) return;
                    const e = equip(r.profile, cat, sel.id);
                    this.commit(
                      e.ok ? e.profile : r.profile,
                      { path: '/shop/buy', body: { id: sel.id } },
                      { path: '/shop/equip', body: { cat, id: sel.id } },
                    );
                    this.celebrate('buy');
                    refresh();
                    this.react('joy');
                  },
                  { 'data-test': 'shop-cta', 'data-why': `You have ${p.coins} Fitile.`, style: ctaStyle },
                ),
                p.coins < sel.price,
              );
    return this.page(
      'shop fit',
      head(
        'SHOP',
        this.backTo(),
        seg(
          'Shop category',
          SHOP_CATS.map((k) => [k, CAT_NAMES[k]] as const),
          cat,
          (k) => {
            this.shopPick = null;
            this.showScreen(() => this.shopMenu(k));
          },
          'data-cat',
        ),
        h('div', { class: 'push' }),
        coins(p.coins),
      ),
      h(
        'div',
        { class: 'body' },
        this.heroBox(
          'tl2',
          { ch, outfit: tryOn, bomb: cat === 'bomb' },
          null,
          h(
            'div',
            {
              class: 'tag',
              style:
                'left:10px;top:10px;color:var(--ink);background:var(--white);font:800 11px var(--body);padding:1px 8px',
            },
            'TRYING ON',
          ),
          h('div', { class: 'foot ink' }, sel ? sel.name : '—'),
        ),
        h(
          'div',
          { class: 'col grow', style: 'gap:12px' },
          h(
            'div',
            { class: 'cards' },
            ...items.map((it) => {
              const o = p.owned.includes(it.id);
              const w = p.eq[cat] === it.id;
              const ic =
                cat === 'color'
                  ? h('i', {
                      class: 'sicon',
                      style: `background:${it.col === 'rainbow' ? 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' : (it.col ?? '#fff')}`,
                    })
                  : cat === 'fatality'
                    ? this.fatPreviews.add({ id: it.fatality!, ch })
                    : cat === 'emote'
                      ? h('i', { class: 'sicon' }, emoteById(it.emote)?.icon ?? '?')
                      : cat === 'voice' || cat === 'trail'
                        ? h(
                            'i',
                            { class: 'sicon', style: it.col ? `color:${it.col}` : '' },
                            cat === 'voice' ? '🔊' : '✦',
                          )
                        : this.portraits.add({ ch, outfit: { ...p.eq, [cat]: it.id }, bomb: cat === 'bomb' });
              return h(
                'button',
                {
                  class: 'card sitem' + (w ? ' eq' : ''),
                  'data-item': it.id,
                  'aria-pressed': String(sel === it),
                  onclick: () => {
                    this.sfx.init();
                    if (it.voice) this.sfx.voiceLine(it.voice);
                    this.shopPick = it.id;
                    refresh();
                  },
                },
                ic,
                h(
                  'span',
                  {},
                  h('b', {}, it.name),
                  h(
                    'small',
                    { class: !o && it.unlock ? 'lock-txt' : '' },
                    w
                      ? 'Wearing'
                      : o
                        ? 'Owned'
                        : it.unlock
                          ? `Locked · ${charById(it.unlock.char).name} Lv ${it.unlock.level}`
                          : `${it.price} Fitile`,
                  ),
                ),
              );
            }),
          ),
          h('div', { class: 'grow' }),
          h(
            'div',
            { style: 'display:flex;align-items:center;gap:14px' },
            caption(
              'Everything here is cosmetic. Nothing in the shop makes you stronger.',
              undefined,
              'grow info',
            ),
            cta,
          ),
        ),
      ),
    );
  }

  /** Aplică recompensele meciului pe profil; întoarce rândul „You got” și ce s-a deblocat. */
  private grantRewards(won: boolean, team: boolean): { line: HTMLElement; ups: [string, string][] } {
    const r: Rewards = reward(store.profile, { ...this.sum, won, team }, today());
    store.set(r.profile);
    // cont legat: serverul recalculează recompensa (meciurile online le scrie deja camera)
    if (account.linked && !store.active && !this.match?.net)
      account.claim({ ...this.sum, won, team }, (q) => this.adopt(q));
    const ch = charById(r.profile.ch);
    const lv = levelOf(r.profile.xp[ch.id] ?? 0);
    const ups: [string, string][] = [
      ...r.levelUps.map((l): [string, string] => [
        `${ch.name} reached Lv ${l.level}`,
        [
          l.item ? `Unlocked: ${shopItem(l.item)!.name}` : '',
          l.title ? `Title: ${l.title}` : '',
          `+${l.coins} Fitile`,
        ]
          .filter(Boolean)
          .join(' · '),
      ]),
      ...r.playerUps.map((u): [string, string] => [
        `Player level ${u.level}`,
        u.unlocks.length ? `Unlocked: ${u.unlocks.join(', ')}` : '',
      ]),
      ...r.keptThemes.map((t): [string, string] => [`${themeById(t).name} theme`, 'It’s yours to keep!']),
    ];
    const line = h(
      'div',
      { class: 'cap info', 'data-test': 'rewards' },
      h('b', {}, 'You got: '),
      `+${r.coins} Fitile${r.daily ? ` (incl. +${r.daily} daily)` : ''} · +${r.xp} XP ${ch.name}${r.firstToday ? ' (×2, first match today)' : ''} · Lv ${lv.level}`,
    );
    return { line, ups };
  }

  /** Cumpărare, nivel nou, recompensă: sunet și vibrație (explozia o desenează ecranul). */
  private celebrate(kind: 'buy' | 'level'): void {
    this.sfx.init();
    this.sfx.ui('tada');
    vibrate(kind === 'buy' ? 30 : [30, 60, 30]);
  }

  private voiceOf(id: number): string {
    const sl = this.match?.slots[id];
    return shopItem(sl?.outfit?.voice)?.voice ?? charById(sl?.ch).voice;
  }

  private linesOf(id: number, kind: 'quips' | 'win'): readonly string[] {
    const sl = this.match?.slots[id];
    if (!sl?.ch) return kind === 'quips' ? QUIPS : TAUNTS;
    return shopItem(sl.outfit?.voice)?.[kind] ?? charById(sl.ch)[kind];
  }

  private legend(): HTMLElement {
    const it = (b: string, t: string) => h('span', {}, h('b', {}, b), ' ' + t);
    return h(
      'div',
      { class: 'legend' },
      it('Glove:', 'double tap to drop and pick up a bomb; tap to throw it over walls'),
      it('Kick:', 'walk into a bomb to kick it'),
      it('Portal:', 'opens for 15s after a chain of 4+ bombs'),
      it('Red dashed border with −:', 'bad power-up, avoid it'),
      it('Gold crate:', 'guaranteed max power-up'),
      it('Cracked purple crate:', 'curse: spiders or lightning clouds'),
      it('Shield:', '10s; saves you from one blast'),
      it('Detonator:', 'your bombs blow up when you press BOOM!'),
      it('Line:', 'double tap: all your bombs in a line'),
    );
  }

  private practiceMenu(): HTMLElement {
    const done = new Set(settings.challenges);
    return this.page(
      'practice',
      head(
        'PRACTICE',
        this.backTo(),
        caption('No pressure. Nobody is watching. Probably.', undefined, 'push'),
      ),
      h(
        'div',
        { class: 'body' },
        h(
          'div',
          { class: 'col', style: 'width:260px;flex:none' },
          h('h2', { class: 'sub-title' }, 'TUTORIAL'),
          btn(
            'main',
            settings.tutorialDone ? 'REPLAY TUTORIAL' : 'TUTORIAL · 6 STEPS',
            () => this.start({ type: 'tutorial', step: 'move' }),
            { 'data-test': 'tutorial', style: 'font-size:24px' },
          ),
          h('h2', { class: 'sub-title paper' }, 'TRAINING'),
          h(
            'div',
            { class: 'cards', style: '--cols:2' },
            h(
              'button',
              { class: 'card', 'data-test': 'dummies', onclick: () => this.start({ type: 'dummies' }) },
              h('b', {}, 'Dummies'),
              h('small', {}, 'targets that stand still'),
            ),
            h(
              'button',
              { class: 'card', 'data-test': 'bots', onclick: () => this.go(() => this.playMenu()) },
              h('b', {}, 'Bots'),
              h('small', {}, BOT_NAMES[settings.bots]),
            ),
          ),
        ),
        h(
          'div',
          { class: 'col grow' },
          OFFLINE_ONLY ? null : h('h2', { class: 'sub-title' }, 'DAILY CHALLENGE'),
          OFFLINE_ONLY
            ? null
            : h(
                'div',
                { class: 'cards' },
                h(
                  'button',
                  { class: 'card', 'data-test': 'daily', onclick: () => void this.startDaily() },
                  h('b', {}, 'Today’s challenge'),
                  h('small', {}, 'Same for everyone. Fastest time wins.'),
                ),
                h(
                  'button',
                  { class: 'card', 'data-test': 'daily-board', onclick: () => void this.openDailyBoard() },
                  h('b', {}, 'Leaderboard'),
                  h('small', {}, 'Today’s top 20'),
                ),
              ),
          h('h2', { class: 'sub-title' }, 'CHALLENGES'),
          h(
            'div',
            { class: 'cards' },
            ...CHALLENGES.map((c) =>
              h(
                'button',
                {
                  class: 'card',
                  'data-challenge': c,
                  title: CHALLENGE_TEXT[c].desc,
                  onclick: () => this.start({ type: 'challenge', id: c }),
                },
                h('b', {}, CHALLENGE_TEXT[c].name),
                h('small', {}, CHALLENGE_TEXT[c].desc),
                done.has(c) ? tag('DONE!', 'new ok') : null,
              ),
            ),
          ),
          h('h2', { class: 'sub-title paper' }, 'HOW THINGS WORK'),
          this.legend(),
        ),
      ),
    );
  }

  private themeGrid(onPick: (id: string) => void): HTMLElement {
    const season = seasonalTheme(now())?.id;
    const a = store.access();
    const p = store.profile;
    return h(
      'div',
      { class: 'cards', style: '--cols:5' },
      ...THEMES.map((t) => {
        const st = themeState(p, t.id, a);
        const why =
          st.kind === 'level'
            ? `Not yet. Level ${st.level}.`
            : st.kind === 'buy' && p.coins < st.price
              ? `You have ${p.coins} Fitile.`
              : undefined;
        const sub =
          st.kind === 'level'
            ? h('small', { class: 'lock-txt' }, `Player Lv ${st.level}`)
            : st.kind === 'buy'
              ? h('small', {}, `${st.price} Fitile`)
              : st.kind === 'event'
                ? h('small', {}, 'free now · play to keep')
                : h('small', {}, t.id === season ? 'season' : t.season ? 'event' : 'yours');
        return lock(
          h(
            'button',
            {
              class: 'card',
              'aria-pressed': String(t.id === this.theme.id),
              'data-theme': t.id,
              'data-why': why,
              onclick: () => {
                if (st.kind === 'buy') {
                  const r = buyTheme(store.profile, t.id, store.access());
                  if (!r.ok) return;
                  this.commit(r.profile, { path: '/themes/buy', body: { id: t.id } });
                  this.celebrate('buy');
                }
                onPick(t.id);
              },
            },
            h(
              'span',
              { class: 'sw' },
              ...[t.ink, t.accent, t.flame[1], t.portal].map((c) => h('i', { style: `background:${c}` })),
            ),
            h('b', {}, t.name),
            sub,
            !why && st.kind !== 'buy' && !p.seen.includes(`theme:${t.id}`) ? tag('NEW', 'new ok') : null,
          ),
          !!why,
        );
      }),
    );
  }

  private themesMenu(): HTMLElement {
    queueMicrotask(() => this.seeAll('theme'));
    return this.page(
      'themes',
      head(
        'THEMES',
        this.backTo(),
        caption('A theme changes only the arena. The menus stay the same.', undefined, 'push'),
      ),
      this.themeGrid((id) => {
        this.setTheme(id);
        this.showScreen(() => this.themesMenu());
      }),
    );
  }

  /** Comutator ON/OFF cu ștampilă; sunetul ștampilei urmează noua stare. */
  private toggle(label: string, hint: string | null, on: boolean, fn: () => void, slim = false): HTMLElement {
    const el = stampSwitch(label, hint, on, () => {
      fn();
      save();
      const now_ = !on;
      this.sfx.init();
      this.sfx.ui(now_ ? 'stamp' : 'stampOff');
      vibrate(15);
      if (label === 'Sound') this.react(now_ ? 'unmute' : 'mute');
      this.rerenderSwitch(el, now_);
      on = now_;
    });
    if (slim) el.classList.add('slim');
    el.dataset.toggle = label.split(' ')[0]!.toLowerCase();
    return el;
  }

  /** Schimbă doar ștampila (fără să redeseneze ecranul), ca să cadă din nou. */
  private rerenderSwitch(el: HTMLElement, on: boolean): void {
    el.setAttribute('aria-checked', String(on));
    const st = el.querySelector('.stamp')!;
    const fresh = h('span', { class: 'stamp' + (on ? ' on' : ' off') }, on ? 'ON' : 'OFF');
    st.replaceWith(fresh);
  }

  private settingsMenu(onBack: () => void = this.backTo()): HTMLElement {
    const Q: (readonly [Quality, string])[] = [
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
    ];
    const self = () => this.settingsMenu(onBack);
    return this.page(
      'settings',
      head('SETTINGS', onBack, h('div', { class: 'push cap info plain' }, `version ${__APP_VERSION__}`)),
      h(
        'div',
        { class: 'body', style: 'gap:18px' },
        h(
          'div',
          {
            class: 'grow',
            style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-content:start',
          },
          this.toggle('Sound', 'Explosions, voices, clicks', settings.sound, () => {
            settings.sound = !settings.sound;
            this.applyAudio();
          }),
          this.toggle('Music', 'Menu and match music', settings.music, () => {
            settings.music = !settings.music;
            this.applyAudio();
          }),
          this.toggle(
            'Vibration',
            'Feel the blasts in your palm',
            settings.vibration,
            () => (settings.vibration = !settings.vibration),
          ),
          this.toggle('Motion effects', 'Screen shake, zooms, slow motion', settings.motion, () => {
            settings.motion = !settings.motion;
            this.scene.motion = settings.motion;
            this.applyMotion();
          }),
          // aspectul interfeței (Comic / Toy), doar în build-urile de dezvoltare: e pentru comparație (D-073)
          DEV_TOOLS &&
            h(
              'div',
              { class: 'lookrow' },
              h('div', { class: 'label' }, 'Look'),
              seg(
                'Interface look',
                [
                  ['comic', 'Comic'],
                  ['toy', 'Toy'],
                ] as const,
                currentSkin(),
                (s) => {
                  settings.skin = s;
                  save();
                  applySkin();
                  this.showScreen(self);
                },
                'data-skin-pick',
              ),
            ),
        ),
        panel(
          'tr col side',
          h('h2', { class: 'sub-title' }, 'PICTURE'),
          h('div', { class: 'label', style: 'text-transform:none;font-size:13px' }, '3D graphics quality'),
          seg('3D graphics quality', Q, settings.quality, (q) => {
            settings.quality = q;
            save();
            this.r3?.setQuality(q);
            this.showScreen(self);
          }),
          h('div', { class: 'label', style: 'text-transform:none;font-size:13px' }, 'View'),
          seg(
            'Default view',
            VIEWS.map((v) => [v, VIEW_LBL[v]] as const),
            settings.view,
            (v) => {
              settings.view = v;
              save();
              void this.setView(v, false);
              this.showScreen(self);
            },
          ),
          h('div', { class: 'grow' }),
          h(
            'div',
            { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' },
            btn('sec', 'PRIVACY', () => this.go(() => this.legalScreen('privacy', self)), {
              'data-test': 'privacy',
              style: 'font-size:15px',
            }),
            btn('sec', 'TERMS', () => this.go(() => this.legalScreen('terms', self)), {
              'data-test': 'terms',
              style: 'font-size:15px',
            }),
            account.linked
              ? btn('sec', 'DELETE ACCOUNT', () => this.go(() => this.deleteAccountScreen(self)), {
                  'data-test': 'delete-account',
                  style: 'font-size:15px',
                })
              : null,
          ),
          h(
            'div',
            { style: 'font-size:12px;line-height:1.3' },
            account.linked
              ? 'Your progress is saved on your account.'
              : 'Your progress is saved on this phone.',
            h('br'),
            'Keys: arrows / WASD, Space bomb, E BOOM!, V view, P pause.',
          ),
        ),
      ),
    );
  }

  /** Textele legale (provizorii, Q-011). */
  private legalScreen(kind: 'privacy' | 'terms', onBack: () => HTMLElement): HTMLElement {
    const page = LEGAL[kind];
    return this.page(
      'legal',
      head(page.title.toUpperCase(), () => this.go(onBack)),
      h(
        'div',
        { class: 'body', style: 'overflow:auto' },
        panel(
          'col grow',
          caption(LEGAL_PLACEHOLDER, undefined, 'info'),
          ...page.sections.flatMap((s) => [h('h2', { class: 'sub-title' }, s.h), h('p', {}, s.p)]),
        ),
      ),
    );
  }

  /** Confirmarea ștergerii contului: șterge datele de pe server și resetează profilul local. */
  private deleteAccountScreen(onBack: () => HTMLElement): HTMLElement {
    return this.page(
      'legal',
      head('DELETE ACCOUNT', () => this.go(onBack)),
      h(
        'div',
        { class: 'body' },
        panel(
          'col grow',
          h(
            'p',
            {},
            'This erases your account and everything saved on the server: characters, items, Fitile, trophies and match history. It cannot be undone.',
          ),
          btn(
            'main',
            'YES, DELETE EVERYTHING',
            async () => {
              if (await account.remove()) {
                store.set(defaultProfile());
                this.showBanner('Account deleted.', 2400);
                this.go(() => this.mainMenu());
              } else this.showBanner('Could not delete. Check your connection and try again.', 3200, 'bad');
            },
            { 'data-test': 'delete-confirm' },
          ),
          btn('sec', 'KEEP MY ACCOUNT', () => this.go(onBack)),
        ),
      ),
    );
  }

  /** Pauza: ecran modal peste meci. */
  private pauseDrawer(): HTMLElement {
    const sheetIn = (title: string, body: HTMLElement) => {
      const close = () => sheet.remove();
      const sheet: HTMLElement = h(
        'div',
        { class: 'sheet', onclick: (e: Event) => e.target === sheet && close() },
        panel(
          'col',
          h('div', { class: 'head' }, sq(icon.back(), 'Close', close), h('h1', { class: 'ptitle' }, title)),
          body,
        ),
      );
      this.drawer.append(sheet);
    };
    if (this.online || this.inf)
      return h(
        'div',
        { class: 'modal' },
        h(
          'div',
          { class: 'mpanel', role: 'dialog', 'aria-label': 'Menu' },
          caption('Meanwhile, the bombs keep ticking…'),
          this.sideHero('Be right back!', null),
          h(
            'div',
            { class: 'col grow', style: 'gap:12px' },
            h('h1', { class: 'ptitle' }, 'MENU'),
            h('div', {}, 'The match keeps going online. Your character stands still.'),
            btn('main', 'BACK TO THE BOOM!', () => this.resume(), { class: 'huge', 'data-test': 'resume' }),
            h(
              'div',
              { style: 'display:flex;gap:10px;align-items:center' },
              this.toggle(
                'Sound',
                null,
                settings.sound,
                () => {
                  settings.sound = !settings.sound;
                  this.applyAudio();
                },
                true,
              ),
              btn('sec', 'LEAVE ROOM', () => this.toMenu(), {
                'data-test': 'quit',
                style: 'transform:none;box-shadow:none',
              }),
            ),
          ),
        ),
      );
    const mode = this.kind.type === 'mode' ? this.kind.mode : null;
    return h(
      'div',
      { class: 'modal' },
      h(
        'div',
        { class: 'mpanel', role: 'dialog', 'aria-label': 'Paused' },
        caption('Meanwhile, the bombs are waiting…'),
        this.sideHero('Zzz', 'blink', 'zzz'),
        h(
          'div',
          { class: 'col grow', style: 'gap:12px' },
          h('h1', { class: 'ptitle', style: 'font-size:44px;letter-spacing:4px' }, 'PAUSED'),
          btn('main', 'BACK TO THE BOOM!', () => this.resume(), { class: 'huge', 'data-test': 'resume' }),
          h(
            'div',
            { class: 'two' },
            btn(
              'sec',
              [
                h('span', {}, mode ? `MODE: ${MODES[mode].name.toUpperCase()}` : 'NEW ROUND'),
                h('small', {}, mode ? 'changing it restarts the round' : 'start again'),
              ],
              () =>
                mode
                  ? sheetIn(
                      'MODE',
                      this.modeGrid(mode, (m) => {
                        settings.mode = m;
                        save();
                        show(this.drawer, false);
                        this.start({ type: 'mode', mode: m });
                      }),
                    )
                  : this.restart(),
              { class: 'stack', 'data-test': 'pause-mode' },
            ),
            btn(
              'sec',
              `THEME: ${this.theme.name.toUpperCase()}`,
              () =>
                sheetIn(
                  'THEME',
                  this.themeGrid((id) => {
                    this.setTheme(id);
                    this.drawer.replaceChildren(this.pauseDrawer());
                  }),
                ),
              { 'data-test': 'pause-theme' },
            ),
          ),
          h(
            'div',
            { style: 'display:flex;gap:10px;align-items:center' },
            this.toggle(
              'Sound',
              null,
              settings.sound,
              () => {
                settings.sound = !settings.sound;
                this.applyAudio();
              },
              true,
            ),
            this.toggle(
              'Music',
              null,
              settings.music,
              () => {
                settings.music = !settings.music;
                this.applyAudio();
              },
              true,
            ),
            btn('sec', 'QUIT TO MENU', () => this.toMenu(), {
              'data-test': 'quit',
              style: 'transform:none;box-shadow:none;font-size:19px',
            }),
            sq(icon.gear(), 'All settings', () =>
              this.showScreen(() => this.settingsMenu(() => this.hideOverlay())),
            ),
          ),
        ),
      ),
    );
  }

  /* ---------- tranziții ---------- */

  /** Mișcare redusă: tranzițiile devin schimbări instantanee. */
  private reduced(): boolean {
    return !settings.motion;
  }

  private fxRun(kids: (Node | null)[], ms: number, block: boolean): void {
    clearTimeout(this.fxTimer);
    this.fx.className = 'fx' + (block ? ' block' : '');
    this.fx.replaceChildren(...kids.filter((k): k is Node => k !== null));
    this.fxTimer = setTimeout(() => {
      show(this.fx, false);
      this.fx.replaceChildren();
    }, ms);
  }

  /** Banda de cerneală (~0,5s); pagina se schimbă la jumătate. */
  private wipe(swap: () => void): void {
    if (this.reduced() || this.fxBusy) return swap();
    this.sfx.init();
    this.sfx.ui('whoosh');
    this.fxRun([h('div', { class: 'wipe' })], 540, true);
    setTimeout(swap, 260);
  }

  /** Startul de meci: fitilul arde spre bombă cu 3-2-1 (2,1s), apoi explozia (~0,9s). */
  private fuse(done: () => void, where: string, event: [string, string] | null): void {
    if (this.reduced()) {
      done();
      if (event) this.showBanner(`${event[0]} ${event[1]}`, 2400, 'gold');
      return;
    }
    this.fxBusy = true;
    this.sfx.init();
    const sz = this.sfx.sizzle(2.1);
    this.fxRun(
      [
        h('div', { class: 'fuse-dim' }),
        h('div', { class: 'fuse-where' }, where),
        event && caption(event[1], event[0], 'fuse-event'),
        h('div', { class: 'count' }, h('span', {}, '3'), h('span', {}, '2'), h('span', {}, '1')),
        h(
          'div',
          { class: 'fuse' },
          h('div', { class: 'cord' }, h('div', { class: 'spark' }, burst('spark-ico'))),
          h('div', { class: 'bombx' }),
        ),
      ],
      60_000,
      true,
    );
    [0, 700, 1400].forEach((t) => setTimeout(() => vibrate(10), t));
    setTimeout(() => {
      sz.stop();
      this.fxBusy = false;
      done();
      this.boom();
    }, 2100);
  }

  /** Explozia care acoperă ecranul și dezvăluie pagina următoare. */
  private boom(): void {
    if (this.reduced()) return;
    this.sfx.init();
    this.sfx.boom();
    vibrate(80);
    const star = burst('boom-star');
    this.fxRun([star, h('div', { class: 'boom-word' }, 'BOOM!')], 900, false);
  }

  /* ---------- flux ---------- */

  private applyAudio(): void {
    this.sfx.sfxOn = settings.sound;
    this.music.on = settings.music && settings.sound;
    this.synth.on = settings.sound;
  }

  /** Pachetul de voce din fișiere, încărcat o dată după ce există AudioContext (primul meci). */
  private loadVoice(): void {
    if (this.voiceLoading || !this.sfx.ctx) return;
    this.voiceLoading = true;
    const pack = new FileVoice(DEFAULT_VOICE, this.sfx, this.synth);
    void pack.load().then(() => (this.voice = pack));
  }

  private aspect(): number {
    // doar landscape (D-054): arena e mereu mai lată decât înaltă
    const w = innerWidth;
    const hgt = innerHeight - 50;
    return Math.max(1, w / Math.max(1, hgt));
  }

  private control() {
    return {
      dir: () => this.resolveDir(),
      face: () => (this.view !== '2d' && this.r3 ? this.r3.faceDir() : undefined),
    };
  }

  /** Pregătirile comune oricărui meci: audio, ecran, controale. */
  private beginPlay(): void {
    this.sfx.init();
    this.loadVoice();
    this.applyAudio();
    this.music.start();
    try {
      void (navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } }).wakeLock
        ?.request('screen')
        .catch(() => {});
    } catch {
      /* ignorat */
    }
    this.hideOverlay();
    show(this.drawer, false);
    show(this.toast, false);
    show(this.banner, false);
    show(this.tut, false);
    this.controls.reset();
  }

  private attach(m: Match): void {
    this.match = m;
    this.sum = { boxes: 0, kills: 0, won: false, team: false, caps: 0, stars: 0 };
    this.deaths = [];
    m.on((e) => this.onEvent(e));
    this.scene.setMatch(m);
    this.r3?.setMatch(m);
    this.phase = 'play';
    this.controls.enabled = true;
    this.music.playing = true;
    this.hudKey = '';
    if (!this.hintsHidden) setTimeout(() => this.hideHints(), 6000);
  }

  start(kind: PlayKind): void {
    if (this.online) this.leaveOnline();
    if (this.inf) this.leaveInf();
    // momentul mare: startul unui meci din meniu (fitil + explozie); restul pornesc direct
    const big = kind.type === 'mode' && this.phase === 'menu';
    this.beginPlay();
    const sameKind = JSON.stringify(kind) === JSON.stringify(this.kind);
    this.kind = kind;
    if (!sameKind || !this.match) this.scores = [];
    const p = store.profile;
    const m = Match.offline(kind, settings.bots, this.seedN++, this.aspect(), this.control(), {
      ch: this.playCh(),
      outfit: p.eq,
      classic: settings.classic,
      theme: this.theme.id,
    });
    if (!this.scores.length) this.scores = m.team ? [0, 0] : m.slots.map(() => 0);
    this.attach(m);
    if (big) {
      m.paused = true;
      this.controls.enabled = false;
      const ev = arenaEventById(m.s.rules.event);
      this.fuse(
        () => {
          if (this.match !== m || this.phase !== 'play') return;
          m.paused = false;
          this.controls.enabled = true;
          this.startBanners(m.s, false);
        },
        `${this.theme.name} arena · ${MODES[kind.mode].name}`,
        ev && ev.id !== 'calm' ? [`Arena event · ${ev.name}:`, ev.desc] : null,
      );
    } else if (kind.type === 'mode') this.startBanners(m.s);
    if (kind.type === 'tutorial') this.showTut(kind.step);
    else show(this.tut, false);
    if (kind.type === 'challenge') this.showBanner(CHALLENGE_TEXT[kind.id].desc, 3000, 'gold');
    if (kind.type === 'mission') {
      const def = missionById(kind.id)!;
      setTimeout(() => this.showBanner(`${def.name}: ${def.desc}`, 3200, 'gold'), 80);
    }
    if (kind.type === 'dummies')
      this.showBanner('Dummies come back after 2s. Practice chains and kicks!', 2600);
  }

  /** Bannerele de start: bonusurile din 1 vs 1, apoi evenimentul de arenă. */
  private startBanners(s: GameState, withEvent = true): void {
    const ev = withEvent ? arenaEventById(s.rules.event) : null;
    const items = s.rules.startItems.length
      ? 'Starting with: ' + s.rules.startItems.map((i) => ITEM_NAMES[i]).join(' · ')
      : '';
    const event = ev && ev.id !== 'calm' ? `${ev.name}: ${ev.desc}` : '';
    if (items) setTimeout(() => this.showBanner(items, 2600), 60);
    if (event) setTimeout(() => this.showBanner(event, 2400, 'gold'), items ? 2700 : 60);
  }

  restart(): void {
    if (this.online || this.inf) return;
    this.start(this.kind);
  }

  /** Online, după meci: înapoi în lobby-ul camerei (camera rămâne deschisă). */
  private toLobby(): void {
    this.match = null;
    this.scene.setMatch(null);
    this.r3?.setMatch(null);
    this.phase = 'menu';
    this.controls.enabled = false;
    this.music.playing = false;
    show(this.drawer, false);
    show(this.toast, false);
    show(this.bubble, false);
    this.showScreen(() => this.lobbyScreen());
  }

  toMenu(): void {
    if (this.online) this.leaveOnline();
    if (this.inf) this.leaveInf();
    show(this.side, false);
    this.board.replaceChildren();
    this.match = null;
    this.scene.setMatch(null);
    this.r3?.setMatch(null);
    this.phase = 'menu';
    this.controls.enabled = false;
    this.music.playing = false;
    show(this.drawer, false);
    this.drawer.replaceChildren();
    show(this.toast, false);
    show(this.tut, false);
    show(this.bubble, false);
    show(this.frameEl, false);
    this.showScreen(() => this.mainMenu());
  }

  private pause(): void {
    if (this.phase !== 'play' || !this.match) return;
    this.phase = 'paused';
    this.match.paused = true;
    this.controls.enabled = false;
    this.controls.reset();
    this.drawer.replaceChildren(this.pauseDrawer());
    show(this.drawer, true);
    this.sfx.ui('tick');
  }

  private resume(): void {
    if (this.phase !== 'paused' || !this.match) return;
    show(this.drawer, false);
    this.drawer.replaceChildren();
    this.phase = 'play';
    this.match.paused = false;
    this.controls.enabled = true;
  }

  private togglePause(): void {
    if (this.phase === 'play') this.pause();
    else if (this.phase === 'paused') this.resume();
  }

  private hideHints(): void {
    this.hintsHidden = true;
    for (const el of this.hints) el.style.opacity = '0';
  }

  /* ---------- vederi ---------- */

  private cycleView(): void {
    this.setView(VIEWS[(VIEWS.indexOf(this.view) + 1) % VIEWS.length]!, true);
  }

  async setView(v: View, persist: boolean): Promise<void> {
    if (v !== '2d' && !this.r3) {
      this.r3loading ??= import('./render3d/Renderer3D.ts')
        .then(({ Renderer3D }) => {
          try {
            const r = new Renderer3D($('#cv3'), this.theme, settings.quality);
            r.setMatch(this.match);
            return r;
          } catch (e) {
            console.warn('3D indisponibil', e);
            return null;
          }
        })
        .catch(() => null);
      this.r3 = await this.r3loading;
      if (!this.r3) v = '2d';
    }
    this.view = v;
    if (persist) {
      settings.view = v;
      save();
    }
    this.viewBtn.textContent = VIEW_LBL[v];
    this.controls.view = v;
    this.scene.mini = v !== '2d';
    this.r3?.setView(v);
    show($('#cv3'), v !== '2d');
    show(this.bomb3, v !== '2d' && this.phase !== 'menu');
    const sp = this.hints[1]!.querySelector('span');
    if (sp)
      sp.textContent =
        v === '2d' ? 'Tap anywhere on this side to drop a bomb' : 'Drag on this side to look around';
  }

  /** Direcția pe grilă din joystick/tastatură, după vedere și mod. */
  private resolveDir(): Dir | null {
    const m = this.match;
    if (!m) return null;
    if (this.view !== '2d' && this.r3) return this.r3.inputDir(this.controls.vector3());
    const v = this.controls.vector();
    const rot = m.s.rot;
    if (!rot) return quantize(v);
    // arena rotativă: joystick-ul urmează ecranul → direcția de pe grilă cea mai apropiată, cu histerezis
    if (!v) {
      this.rotHeld = null;
      return null;
    }
    const a = (rot.a / DEG) * (Math.PI / 180);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const wx = c * v[0] + sn * v[1];
    const wy = -sn * v[0] + c * v[1];
    const held = this.rotHeld;
    if (held !== null) {
      const hx = [0, 0, -1, 1][held]!;
      const hy = [-1, 1, 0, 0][held]!;
      if (wx * hx + wy * hy > 0.6) return held;
    }
    this.rotHeld = quantize([wx, wy]);
    return this.rotHeld;
  }

  private humanTap(): boolean {
    const m = this.match;
    if (!m || this.phase !== 'play') return false;
    const now = performance.now();
    const dbl = now - this.lastTapT < 300;
    this.lastTapT = dbl ? -1e9 : now;
    m.tap(dbl ? 2 : 1);
    const me = m.me;
    const ok = me.alive && (me.carry !== null || me.active < me.bombs || me.glove);
    if (ok) vibrate(20);
    this.r3?.kick();
    this.hideHints();
    return ok;
  }

  /* ---------- bucla ---------- */

  private frame(dt: number): void {
    const m = this.match;
    if (!m) {
      this.r3?.render(dt);
      return;
    }
    if (this.r3 && this.view !== '2d') {
      this.r3.look(this.controls.lookDX, this.controls.turn(), dt);
      this.controls.lookDX = 0;
    }
    m.update(this.phase === 'play' || this.phase === 'over' ? dt : 0);
    this.updateHud();
    this.updateBubble();
    show(this.det, m.hasRemote && this.phase === 'play');
    show(this.bomb3, this.view !== '2d' && this.phase === 'play');
    this.updateButtons();
    this.updateArrow();
    this.updateFrame();
    if (this.view !== '2d') this.r3?.render(dt);
  }

  /** Butonul Super (inelul de încărcare) și bomba specială următoare (pe buton și pe BOMB în 3D). */
  private updateButtons(): void {
    const me = this.match!.me;
    const play = this.phase === 'play' && me.alive;
    const hero = me.hero ? charById(me.hero.id).ultimate : null;
    const em = emoteById(this.match!.myEmote);
    show(this.emoteBtn, play && !!em);
    if (em && this.emoteBtn.textContent !== em.icon) {
      this.emoteBtn.textContent = em.icon;
      this.emoteBtn.setAttribute('aria-label', `Emote: ${em.name}`);
    }
    show(this.sup, play && !!hero);
    if (hero) {
      const pct = Math.round((100 * me.charge) / SUPER_FULL);
      this.sup.style.setProperty('--c', `${pct}%`);
      this.sup.style.setProperty('--hc', charById(me.hero!.id).color);
      this.sup.classList.toggle('ready', pct >= 100);
      const key = pct >= 100 ? hero.name : `SUPER${pct}%`;
      if (this.sup.dataset.key !== key) {
        this.sup.dataset.key = key;
        this.sup.setAttribute('aria-label', pct >= 100 ? `Super ${hero.name}, ready` : `Super, ${pct}%`);
        this.sup.replaceChildren(
          ...(pct >= 100
            ? [h('span', { class: 'name' }, hero.name)]
            : [h('span', {}, 'SUPER'), h('span', { class: 'pct' }, `${pct}%`)]),
        );
      }
    }
    // flashbang / ceață în 3D (în 2D le desenează scena)
    const fog = arenaEventById(this.match!.s.rules.event)?.fog === true;
    const dark = this.view !== '2d' && play && (me.blindT > 0 || fog);
    show(this.dark, dark);
    if (dark) this.dark.style.opacity = me.blindT > 0 ? '0.95' : '0.6';
    const next = me.specials[0];
    show(this.spec, play && next !== undefined);
    this.bomb3.dataset.kind = next ?? '';
    if (next) {
      const n = me.specials.filter((k) => k === next).length;
      this.spec.dataset.kind = next;
      const i = this.spec.querySelector('i')!;
      if (i.textContent !== next.toUpperCase()) i.textContent = next.toUpperCase();
      const b = this.spec.querySelector('b')!;
      if (b.textContent !== `×${n}`) b.textContent = `×${n}`;
      this.spec.classList.toggle(
        'more',
        me.specials.some((k) => k !== next),
      );
    }
  }

  /** Chenarul de cerneală în jurul arenei (sau al minimapei în 3D). */
  private updateFrame(): void {
    const r = this.scene.frameRect();
    show(this.frameEl, !!r);
    if (!r) return;
    const k = `${r.x},${r.y},${r.w},${r.h},${this.view}`;
    if (this.frameEl.dataset.k === k) return;
    this.frameEl.dataset.k = k;
    Object.assign(this.frameEl.style, {
      left: `${r.x}px`,
      top: `${r.y}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
    });
    this.frameEl.classList.toggle('mini', this.view !== '2d');
  }

  /* ---------- evenimente ---------- */

  private onEvent(e: MatchEvent): void {
    const m = this.match;
    if (!m) return;
    const me = m.me;
    const mine = (id: number | null) => id === m.meId;
    switch (e.type) {
      case 'bombPlaced': {
        const n = m.s.events.filter((x) => x.type === 'bombPlaced' && x.owner === e.owner).length;
        if (n > 1) {
          if (m.s.events.find((x) => x.type === 'bombPlaced' && x.owner === e.owner) === e) this.sfx.line();
        } else if (mine(e.owner) && me.hicT > 0) this.sfx.hiccup();
        else this.sfx.place();
        break;
      }
      case 'explode': {
        if (m.s.events.find((x) => x.type === 'explode') === e) this.sfx.boom();
        if (me.alive) {
          const d = Math.hypot(me.px / U - e.x, me.py / U - e.y);
          if (d < 3) vibrate(Math.round(30 + 60 * (1 - d / 3)));
        }
        break;
      }
      case 'kick':
        this.sfx.kick();
        break;
      case 'lift':
        this.sfx.lift();
        break;
      case 'throw':
        this.sfx.throw();
        break;
      case 'land':
        this.sfx.kick();
        break;
      case 'teleport':
        this.sfx.tp();
        break;
      case 'portalOpen':
        this.sfx.tp();
        this.showBanner('Chain of 4! A portal opened', 2000, 'gold');
        break;
      case 'pickup': {
        if (!mine(e.player)) break;
        if (m.s.events.some((x) => x.type === 'maxed' && x.player === m.meId)) break; // momentul de glorie preia
        if (isNegative(e.item)) {
          this.sfx.bad();
          vibrate([80, 40, 80]);
        } else if (isGold(e.item)) {
          this.sfx.win();
          vibrate([30, 30, 30, 30, 60]);
        } else {
          this.sfx.pick();
          vibrate(10);
        }
        const name = e.item === 'heart' && !m.s.rules.health ? HEART_ARENA : ITEM_NAMES[e.item];
        this.showBanner(
          name,
          1300,
          isNegative(e.item) ? 'bad' : isGold(e.item) || e.item === 'hex' ? 'gold' : '',
        );
        break;
      }
      case 'super': {
        const hd = m.slots[e.player]?.ch ? charById(m.slots[e.player]!.ch).ultimate : null;
        this.sfx.win();
        if (mine(e.player)) vibrate([30, 30, 60]);
        if (hd)
          this.showBanner(
            `${mine(e.player) ? 'You' : m.slots[e.player]!.name}: ${hd.name}!`,
            1100,
            mine(e.player) ? 'gold' : '',
          );
        break;
      }
      case 'dash':
        this.sfx.kick();
        break;
      case 'stick':
        this.sfx.lift();
        if (mine(e.player)) {
          this.showBanner('A sticky bomb is stuck to you! Pass it on!', 1500, 'bad');
          vibrate([60, 30, 60]);
        }
        break;
      case 'bounce':
        this.sfx.kick();
        break;
      case 'lifeLost':
        this.sfx.shield();
        if (m.slots[e.player]?.ch) this.sfx.voiceLine(this.voiceOf(e.player));
        if (mine(e.player)) {
          this.showBanner(`Lost a heart! ${e.lives} left`, 1300, 'bad');
          vibrate([60, 40, 90]);
        }
        break;
      case 'frozen':
        this.sfx.bad();
        if (mine(e.player)) {
          this.showBanner('Frozen! Tap fast to break free', 1300, 'bad');
          vibrate([40, 20, 40]);
        }
        break;
      case 'blinded':
        if (mine(e.player)) {
          this.showBanner('Flashbang!', 1000, 'bad');
          vibrate(80);
        }
        break;
      case 'trapFire':
        this.sfx.bad();
        break;
      case 'timeStop':
        this.sfx.tp();
        this.showBanner('Time stop!', 1100, mine(e.owner) ? 'gold' : 'bad');
        break;
      case 'crownTake':
        this.sfx.pick();
        this.showBanner(
          mine(e.player) ? 'You have the crown! Keep it!' : `${m.slots[e.player]?.name ?? '?'} has the crown`,
          1300,
          mine(e.player) ? 'gold' : '',
        );
        break;
      case 'crownDrop':
        this.showBanner('The crown fell!', 1100);
        break;
      case 'potatoGive':
        this.sfx.lift();
        if (mine(e.player)) {
          this.showBanner('HOT POTATO! Touch someone to pass it!', 1500, 'bad');
          vibrate([50, 30, 50]);
        } else if (e.from === null)
          this.showBanner(`${m.slots[e.player]?.name ?? '?'} has the hot potato!`, 1300);
        break;
      case 'potatoBoom':
        this.sfx.boom();
        vibrate(80);
        break;
      case 'death': {
        const slot = m.slots[e.player];
        this.deaths.push({ player: e.player, note: this.deathNote(e) });
        this.voice.scream(slot?.voice ?? 0);
        const bot = m.s.players[e.player]!.bot !== null;
        if (slot?.ch) this.sfx.voiceLine(this.voiceOf(e.player));
        if (!bot || Math.random() < 0.5)
          this.voice.say(pickOne(this.linesOf(e.player, 'quips')), 1.1 + (slot?.voice ?? 0) * 0.25);
        const victim = m.s.players[e.player]!;
        if (e.killerId === m.meId && e.player !== m.meId && !(m.team && victim.team === me.team)) {
          this.sum.kills++;
          if (m.slots[m.meId]?.ch) setTimeout(() => this.sfx.voiceLine(this.voiceOf(m.meId)), 380);
        }
        vibrate(bot ? 15 : [60, 40, 90]);
        if (
          e.killerId !== null &&
          e.killerId !== e.player &&
          !m.team &&
          this.scores.length &&
          m.kind.type === 'dummies'
        )
          this.scores[0]!++;
        break;
      }
      case 'boxDestroyed':
        if (e.owner === m.meId) this.sum.boxes++;
        break;
      case 'chargeOut':
        if (mine(e.player)) this.showBanner(`${ABILITY[e.ability]} used up`, 1200, 'bad');
        break;
      case 'immune':
        if (mine(e.player)) this.showBanner('Immune!', 1100);
        break;
      case 'pigeon':
        this.sfx.voiceLine('tada');
        this.showBanner(mine(e.player) ? 'Poof! Your trick saved you!' : 'Poof! A pigeon!', 1500, 'gold');
        break;
      case 'shieldSaved':
        this.sfx.shield();
        if (mine(e.player)) {
          this.showBanner('Your shield saved you!', 1200);
          vibrate([40, 30, 40]);
        }
        break;
      case 'curse':
        if (e.kind === 'spiders') {
          this.showBanner('Cursed crate: SPIDERS!', 1800, 'bad');
          this.sfx.bad();
          vibrate([60, 40, 60]);
        } else {
          this.showBanner('Cursed crate: STORM CLOUDS!', 1800, 'bad');
          this.sfx.thunder(0.5);
          vibrate([80, 60, 120]);
        }
        break;
      case 'strike':
        this.sfx.thunder(0.8);
        break;
      case 'spiderDie':
        this.sfx.spiderDie();
        break;
      case 'shiftWarn':
        this.sfx.shiftWarn();
        break;
      case 'shiftStep':
        this.sfx.shiftStep();
        break;
      case 'pushed':
        if (mine(e.player)) vibrate(15);
        break;
      case 'rotFlip':
        this.showBanner('The arena changes direction!', 1300);
        break;
      case 'hurryUp':
        this.showBanner('Hurry up! The arena is shrinking!', 1800, 'bad');
        this.voice.say('Hurry up! The arena is shrinking!', 1.2);
        this.sfx.bad();
        break;
      case 'flagTake': {
        this.sfx.pick();
        const ally = m.s.players[e.player]!.team === me.team;
        this.showBanner(
          mine(e.player)
            ? 'You stole the flag! Run home!'
            : `${TEAMS[1 - e.team]!.name} team stole the flag!`,
          1500,
          ally ? 'gold' : 'bad',
        );
        vibrate(mine(e.player) ? [40, 30, 80] : 10);
        break;
      }
      case 'flagDrop':
        this.showBanner(`${TEAMS[e.team]!.name} flag dropped!`, 1300);
        break;
      case 'flagReturn':
        if (e.player === null) this.showBanner(`${TEAMS[e.team]!.name} flag is back home`, 1200);
        else
          this.showBanner(
            `${m.slots[e.player]?.name ?? '?'} saved the flag!`,
            1200,
            e.team === me.team ? 'gold' : '',
          );
        break;
      case 'capture':
        this.sfx.win();
        this.showBanner(
          `CAPTURE! ${TEAMS[0].name} ${e.caps[0]} – ${e.caps[1]} ${TEAMS[1].name}`,
          1800,
          e.team === me.team ? 'gold' : 'bad',
        );
        break;
      case 'respawn':
        if (mine(e.player)) show(this.toast, false);
        break;
      case 'hero':
        this.sfx.win();
        setTimeout(() => this.voice.say(e.hero.text, 1.25), 250);
        vibrate([30, 40, 30, 40, 80]);
        break;
      case 'emote': {
        const em = emoteById(e.id);
        if (em) this.sfx.fat(em.sfx);
        break;
      }
      case 'fatality': {
        const f = fatalityById(e.id);
        if (f) this.sfx.fat(f.sfx);
        break;
      }
      case 'bye':
        this.voice.say('Bye bye!', 1.5);
        break;
      case 'ko':
        this.showToast(e.msg);
        break;
      case 'over':
        this.roundOver(e);
        break;
      case 'tutorialDone':
        this.tutorialNext();
        break;
      case 'tutorialFail':
        this.showBanner('Ouch! Try again.', 1200, 'bad');
        setTimeout(() => this.match === m && this.restart(), 1300);
        break;
      case 'challenge':
        if (e.progress.status !== 'playing') this.challengeOver(e.progress.status === 'done');
        this.hudKey = '';
        break;
      case 'hurt':
        this.sfx.bad();
        vibrate([60, 30, 60]);
        this.hudKey = '';
        break;
      case 'missionHit':
        if (e.kind === 'tower' && !e.done) this.sfx.kick();
        if (e.kind === 'cage') this.showBanner('Friend freed! Take them home.', 1500, 'gold');
        break;
      case 'friendHome': {
        const mi = m.s.mission!;
        const f = mi.friends.find((x) => x.id === e.id);
        const name = FRIEND_NAMES[(f?.target ?? 0) % FRIEND_NAMES.length];
        this.sfx.win();
        this.showBanner(`${name} is home! ${mi.count}/${mi.need}`, 1500, 'gold');
        break;
      }
      case 'missionProgress': {
        const mi = m.s.mission!;
        if (mi.def.kind === 'collect') {
          this.sfx.pick();
          this.showBanner(`Crystal ${e.count}/${e.need}`, 1000, 'gold');
        }
        if (mi.def.kind === 'demolish')
          this.showBanner(`Tower destroyed! ${e.count}/${e.need}`, 1300, 'gold');
        break;
      }
    }
  }

  private missionOver(): void {
    const m = this.match!;
    const mi = m.s.mission!;
    const def = missionById(mi.def.id)!;
    const won = !!mi.over?.won;
    const stars = missionStars(m.s);
    if (stars > (settings.stars[def.id] ?? 0)) {
      settings.stars[def.id] = stars;
      save();
    }
    this.phase = 'over';
    this.controls.enabled = false;
    show(this.toast, false);
    this.sum.stars = stars;
    const rewards = this.grantRewards(won, false);
    const t = Math.round((mi.over?.tick ?? m.s.tick) / TICK_HZ);
    const hp = Math.round(m.me.hp);
    const st = def.stars;
    const crit =
      def.kind === 'race'
        ? `★★: ${st.two}s left · ★★★: ${st.three}s left`
        : `★★: under ${st.two}s · ★★★: under ${st.three}s with at least ${st.hp}% health`;
    const order = CHAPTERS.flatMap((c) => c.missions);
    const next = order[order.indexOf(def.id) + 1];
    const canNext = won && next !== undefined && missionUnlocked(next, settings.stars);
    if (won) this.celebrate('level');
    this.showScreen(() =>
      this.result(
        won ? 'MISSION COMPLETE!' : 'MISSION FAILED',
        won,
        [
          h(
            'div',
            { style: 'font-weight:800' },
            won ? def.name : MISSION_END[mi.over?.reason === 'time' ? 'time' : 'dead'],
          ),
          h(
            'div',
            { style: 'display:flex;align-items:center;gap:14px' },
            h(
              'div',
              { class: 'bigstars', 'data-stars': String(stars) },
              ...[1, 2, 3].map((i) => h('span', { class: i <= stars ? 'on' : '' }, '★')),
            ),
            h('div', { style: 'font-weight:800' }, `Time ${t}s · Health ${hp}%`),
          ),
          rewards.line,
          h('div', { style: 'font-size:12px' }, crit),
        ],
        [
          btn('main', won ? 'PLAY AGAIN' : 'TRY AGAIN', () => this.restart(), { 'data-test': 'again' }),
          canNext
            ? btn('sec', 'NEXT MISSION', () => this.start({ type: 'mission', id: next! }), {
                'data-test': 'next-mission',
              })
            : btn('sec', 'MISSION MAP', () =>
                this.wipe(() => {
                  this.toMenu();
                  this.showScreen(() => this.missionsMenu());
                }),
              ),
        ],
      ),
    );
  }

  /** Săgeata spre obiectiv, la marginea ecranului (2D: direcția pe hartă; 3D: relativ la cameră). */
  private updateArrow(): void {
    const m = this.match;
    const g = m && this.phase === 'play' ? missionGoal(m.s) : null;
    const me = m?.me;
    if (!g || !me?.alive) return show(this.arrow, false);
    const dx = g.x - me.px / U;
    const dy = g.y - me.py / U;
    const dist = Math.hypot(dx, dy);
    if (dist < 2.5) return show(this.arrow, false);
    let ang = Math.atan2(dy, dx);
    if (this.view !== '2d' && this.r3) {
      const yaw = this.r3.yawAngle;
      const fw = dx * Math.sin(yaw) + dy * Math.cos(yaw);
      const rt = -dx * Math.cos(yaw) + dy * Math.sin(yaw);
      ang = Math.atan2(-fw, rt);
    }
    const R = Math.min(innerWidth, innerHeight - 44) * 0.38;
    show(this.arrow, true);
    this.arrow.style.transform = `translate(${Math.cos(ang) * R}px,${Math.sin(ang) * R}px)`;
    (this.arrow.firstChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
    (this.arrow.lastChild as HTMLElement).textContent = `${Math.round(dist)}m${g.home ? ' · home' : ''}`;
  }

  private showTut(step: TutorialStep): void {
    const i = TUTORIAL_STEPS.indexOf(step);
    const t = TUTORIAL_TEXT[step];
    this.tut.replaceChildren(h('b', {}, `${i + 1}/6 ${t.title}`), t.hint);
    show(this.tut, true);
  }

  private tutorialNext(): void {
    const k = this.kind;
    if (k.type !== 'tutorial') return;
    const i = TUTORIAL_STEPS.indexOf(k.step);
    this.sfx.win();
    vibrate([30, 30, 60]);
    const next = TUTORIAL_STEPS[i + 1];
    if (next) {
      this.showBanner('Well done!', 1000, 'gold');
      setTimeout(() => this.kind === k && this.start({ type: 'tutorial', step: next }), 1100);
      return;
    }
    settings.tutorialDone = true;
    save();
    setTimeout(() => {
      this.phase = 'over';
      this.controls.enabled = false;
      show(this.tut, false);
      this.celebrate('level');
      this.showScreen(() =>
        this.result(
          'TUTORIAL COMPLETE!',
          true,
          [h('div', {}, 'You know it all: moving, bombs, power-ups, kick, glove. Now for real!')],
          [
            btn('main', 'PLAY AGAINST BOTS', () => {
              this.phase = 'menu';
              this.start({ type: 'mode', mode: 'ffa' });
            }),
            btn('sec', 'MENU', () => this.wipe(() => this.toMenu())),
          ],
        ),
      );
    }, 900);
  }

  /** Provocarea zilei: tipul și seed-ul vin de la server. */
  private async startDaily(): Promise<void> {
    const d = await account.api<{ id: ChallengeId; seed: number }>('/daily');
    if (!d) return this.showBanner('The daily challenge needs a connection.', 2600, 'bad');
    this.start({ type: 'challenge', id: d.id, seed: d.seed, daily: true });
  }

  private async openDailyBoard(): Promise<void> {
    const r = await account.api<{ day: string; top: { rank: number; name: string; ticks: number }[] }>(
      '/daily/leaderboard',
    );
    if (!r) return this.showBanner('The leaderboard needs a connection.', 2600, 'bad');
    this.go(() => this.dailyBoardScreen(r.day, r.top));
  }

  private dailyBoardScreen(day: string, top: { rank: number; name: string; ticks: number }[]): HTMLElement {
    return this.page(
      'daily-board',
      head('DAILY TOP 20', () => this.go(() => this.practiceMenu()), caption(day, undefined, 'push')),
      h(
        'div',
        { class: 'body', style: 'overflow:auto' },
        panel(
          'col grow',
          top.length
            ? h(
                'ol',
                { 'data-test': 'daily-top', style: 'margin:0;padding-left:1.5em;font-size:18px' },
                ...top.map((t) => h('li', {}, `${t.name} · ${(t.ticks / TICK_HZ).toFixed(1)}s`)),
              )
            : h('p', {}, 'Nobody yet. Be the first!'),
        ),
      ),
    );
  }

  /** Trimite rularea la server (care o reia în simulare) și arată timpul verificat. */
  private async submitDaily(): Promise<string> {
    const log = this.match?.log;
    if (!log || !account.linked) return 'Sign-in needed to rank.';
    const r = await account.post('/daily/score', { inputs: log });
    const t = (r.data as { ticks?: number } | null)?.ticks;
    return r.status === 200 && t
      ? `Verified time: ${(t / TICK_HZ).toFixed(1)}s`
      : 'Could not submit the score.';
  }

  private challengeOver(ok: boolean): void {
    const k = this.kind;
    if (k.type !== 'challenge') return;
    const submit = ok && k.daily ? this.submitDaily() : null;
    if (ok && !k.daily && !settings.challenges.includes(k.id)) {
      settings.challenges.push(k.id);
      save();
    }
    if (ok) this.sfx.win();
    setTimeout(
      async () => {
        if (this.kind !== k) return;
        const line = submit ? await submit : null;
        if (this.kind !== k) return;
        this.phase = 'over';
        this.controls.enabled = false;
        this.showScreen(() =>
          this.result(
            ok ? 'CHALLENGE COMPLETE!' : 'CHALLENGE FAILED',
            ok,
            [
              caption(CHALLENGE_TEXT[k.id].desc, `${CHALLENGE_TEXT[k.id].name}:`),
              line ? caption(line, undefined, 'info') : null,
            ],
            [
              btn('main', ok ? 'PLAY AGAIN' : 'TRY AGAIN', () => this.restart(), { 'data-test': 'again' }),
              btn('sec', 'MORE CHALLENGES', () =>
                this.wipe(() => {
                  this.toMenu();
                  this.showScreen(() => this.practiceMenu());
                }),
              ),
            ],
          ),
        );
      },
      ok ? 1600 : 900,
    );
  }

  /** Ecran de rezultat peste meci (misiune, provocare, tutorial): panou cu personajul tău. */
  private result(
    title: string,
    good: boolean,
    body: (Node | null | false)[],
    actions: HTMLElement[],
  ): HTMLElement {
    const c = charById(this.playCh());
    return h(
      'div',
      { class: 'modal' },
      h(
        'div',
        { class: 'mpanel', role: 'dialog', 'aria-label': title },
        caption(good ? 'And the crowd goes wild…' : 'Meanwhile, back at the drawing board…'),
        this.sideHero(this.line(good ? c.win : c.quips), good ? 'happy' : 'doom'),
        h(
          'div',
          { class: 'col grow', style: 'gap:10px' },
          h('h1', { class: 'ptitle' }, title),
          ...body,
          h('div', { class: 'grow' }),
          h('div', { class: 'two' }, ...actions),
        ),
      ),
    );
  }

  private deathNote(e: Extract<MatchEvent, { type: 'death' }>): string {
    const m = this.match!;
    if (e.cause === 'spider') return 'caught by a spider';
    if (e.cause === 'lightning') return 'zapped by lightning';
    if (e.cause === 'crush') return 'squashed';
    if (e.cause === 'hurry') return 'flattened by a falling block';
    if (e.cause === 'poison') return 'poisoned';
    if (e.cause === 'potato') return 'held the hot potato';
    if (e.killerId === e.player) return 'own bomb';
    if (e.killerId !== null) return `blown up by ${m.slots[e.killerId]?.name ?? '?'}`;
    return 'caught in a chain';
  }

  private roundOver(e: Extract<MatchEvent, { type: 'over' }>): void {
    const m = this.match;
    if (!m || m.kind.type === 'challenge' || m.kind.type === 'tutorial') return;
    if (m.kind.type === 'mission') return this.missionOver();
    this.phase = 'over';
    const won = m.team ? e.team !== null && e.team === m.me.team : e.winner === m.meId;
    if (m.s.ctf) this.sum.caps = m.s.ctf.caps[m.me.team] ?? 0;
    const rewards = m.kind.type === 'mode' ? this.grantRewards(won, m.team) : null;
    this.controls.enabled = false;
    show(this.toast, false);
    let title: string;
    let msg: string;
    let star: number | null = null;
    if (m.team) {
      if (e.team !== null) this.scores[e.team]!++;
      const mine = e.team === m.me.team;
      title =
        e.team === null ? 'DRAW!' : mine ? 'YOUR TEAM WON!' : `${TEAMS[e.team]!.name.toUpperCase()} WINS!`;
      msg = m.s.ctf
        ? `${TEAMS[0].name} ${m.s.ctf.caps[0]} – ${m.s.ctf.caps[1]} ${TEAMS[1].name}`
        : e.team === null
          ? 'Nobody is left standing.'
          : mine
            ? 'Teamwork!'
            : 'Next time, together!';
      star =
        e.team === null
          ? null
          : ((
              m.s.players.find((p) => p.team === e.team && p.alive) ??
              m.s.players.find((p) => p.team === e.team)
            )?.id ?? null);
    } else if (e.winner !== null) {
      this.scores[e.winner]!++;
      const w = m.slots[e.winner]!;
      star = e.winner;
      if (e.winner === m.meId) {
        title = 'YOU WIN!';
        msg = 'The arena is yours!';
      } else {
        title = `${w.name.toUpperCase()} WINS!`;
        msg = 'Dancing on the ruins!';
        if (w.ch) this.sfx.voiceLine(this.voiceOf(e.winner));
        this.voice.say(pickOne(this.linesOf(e.winner, 'win')), 1.2 + w.voice * 0.25);
      }
    } else {
      title = 'DRAW!';
      msg = 'Everybody blew up. Nice.';
    }
    if (won) this.celebrate('level');
    else this.sfx.ui('down');
    // clasarea: cei rămași (echipa câștigătoare întâi), apoi eliminații de la ultimul la primul
    const alive = m.s.players.filter((p) => !this.deaths.some((d) => d.player === p.id));
    alive.sort(
      (a, b) =>
        Number(b.id === star) - Number(a.id === star) ||
        (m.team ? Number(b.team === e.team) - Number(a.team === e.team) : 0),
    );
    const order = [
      ...alive.map((p) => ({
        player: p.id,
        note:
          p.id === star && !m.team
            ? 'last one standing'
            : m.team && p.team === e.team
              ? 'still standing'
              : 'survived',
      })),
      ...[...this.deaths].reverse().filter((d, i, a) => a.findIndex((x) => x.player === d.player) === i),
    ];
    const col = (id: number) => this.theme.tint[m.slots[id]!.color] ?? m.slots[id]!.color;
    const sl = star !== null ? m.slots[star] : null;
    this.hudKey = '';
    const ups = rewards?.ups ?? [];
    this.showScreen(() =>
      this.page(
        'final',
        h(
          'div',
          { class: 'panel cyan hero-box tl2' },
          rays(),
          burst(),
          h('h1', {}, title),
          sl
            ? this.portraits.add({
                ch: sl.ch ?? 'bubu',
                outfit: sl.outfit ?? null,
                color: sl.ch ? undefined : col(star!),
                lead: true,
                react: { expr: 'happy', until: performance.now() + 1e9 },
              })
            : null,
          say(msg),
        ),
        h(
          'div',
          { class: 'col grow', style: 'gap:8px' },
          h(
            'div',
            { class: 'ptitle', style: 'align-self:flex-start;font-size:20px;padding:1px 12px' },
            'HOW IT ENDED',
          ),
          h(
            'ol',
            { class: 'ranks' },
            ...order
              .slice(0, 6)
              .map((r, i) =>
                h(
                  'li',
                  { class: (r.player === m.meId ? 'me' : '') + (i >= alive.length ? ' out' : '') },
                  h('span', { class: 'n' }, String(i + 1)),
                  h('i', { class: 'dot', style: `--hc:${col(r.player)}` }),
                  h(
                    'b',
                    {},
                    m.slots[r.player]!.name +
                      (r.player === m.meId && m.slots[r.player]!.name !== 'You' ? ' (you)' : ''),
                  ),
                  h(
                    'small',
                    {},
                    (this.scores.length && !m.team ? `${plural(this.scores[r.player] ?? 0, 'win')} · ` : '') +
                      r.note,
                  ),
                ),
              ),
          ),
          h('div', { class: 'grow' }),
          rewards?.line,
        ),
        h(
          'div',
          { class: 'col', style: 'width:200px;flex:none;justify-content:flex-end;gap:16px' },
          ...ups
            .slice(0, 2)
            .map(([a, b]) =>
              h(
                'div',
                { class: 'lvlup' },
                h('small', {}, 'LEVEL UP!'),
                h('b', {}, a),
                b ? h('span', {}, b) : null,
              ),
            ),
          this.online
            ? btn('main', 'BACK TO THE ROOM', () => this.wipe(() => this.toLobby()), {
                'data-test': 'lobby',
                style: 'min-height:72px',
              })
            : btn('main', 'PLAY AGAIN!', () => this.restart(), {
                'data-test': 'again',
                style: 'min-height:72px',
              }),
          btn('sec', this.online ? 'LEAVE ROOM' : 'MENU', () => this.wipe(() => this.toMenu()), {
            'data-test': 'menu',
          }),
        ),
      ),
    );
  }

  /* ---------- HUD ---------- */

  /** Jucătorii / echipele din stânga barei, după mod (FFA, echipe, steag, misiune, provocare). */
  private chipsHtml(): string {
    const m = this.match!;
    const s = m.s;
    const esc = (t: string) =>
      t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const col = (c: string) => this.theme.tint[c] ?? c;
    const dot = (c: string) => `<i style="background:${col(c)}"></i>`;
    if (m.kind.type === 'tutorial')
      return `<div class="chip me">Tutorial <em>${TUTORIAL_STEPS.indexOf(m.kind.step) + 1}/6</em></div>`;
    if (s.mission) {
      const mi = s.mission;
      const hp = Math.round(m.me.hp);
      const c = hp > 60 ? '#5BE36A' : hp > 30 ? '#FFD60A' : '#E5262B';
      const obj =
        mi.def.kind === 'race'
          ? 'Reach the goal'
          : `${esc(missionById(mi.def.id)?.name ?? '')} <em>${mi.count}/${mi.need}</em>`;
      return (
        `<div class="life" data-hp="${hp}"><i style="width:${hp}%;background:${c}"></i><span>${hp}%</span></div>` +
        `<div class="chip">${obj}</div>`
      );
    }
    if (m.challenge) {
      const c = m.challenge;
      return `<div class="chip me">${esc(CHALLENGE_TEXT[c.id].name)} <em>${c.count}/${c.need}</em></div>`;
    }
    if (m.kind.type === 'infinite') {
      const b = this.inf?.view.board;
      const me = m.me;
      // online scorul vine de la server (o dată pe secundă); offline se calculează local
      const score = b ? b.you[1] : infScore(me);
      return (
        `<div class="chip me" data-test="score">${dot(m.slots[m.meId]!.color)}SCORE <em>${score}</em></div>` +
        `<div class="chip">KO <em>${me.kills}</em></div>` +
        `<div class="chip">FAR <em>${me.far}</em></div>` +
        (b ? `<div class="chip" data-test="rank">#<em>${b.you[0]}</em> of ${b.n}</div>` : '')
      );
    }
    if (m.kind.type === 'dummies')
      return `<div class="chip me">${dot(m.slots[0]!.color)}Eliminations <em>${this.scores[0] ?? 0}</em></div>`;
    if (s.ctf) {
      const ctf = s.ctf;
      const team = (i: number) => {
        const t = TEAMS[i]!;
        const caps = Array.from(
          { length: ctf.need },
          (_, k) => `<b${k < ctf.caps[i]! ? '' : ' class="x"'}></b>`,
        ).join('');
        return i === 0
          ? `<div class="chip team" style="--tc:${t.color}">${esc(t.name.toUpperCase())} <em>${ctf.caps[i]}</em><span class="caps">${caps}</span></div>`
          : `<div class="chip team" style="--tc:${t.color}"><span class="caps">${caps}</span><em>${ctf.caps[i]}</em> ${esc(t.name.toUpperCase())}</div>`;
      };
      const out = ctf.flags.some((f) => !f.atHome) ? '<div class="chip flag">FLAG OUT!</div>' : '';
      return team(0) + out + team(1);
    }
    if (s.crown)
      return s.players
        .map(
          (p) =>
            `<div class="chip${s.crown!.holder === p.id ? ' on' : p.id === m.meId ? ' me' : ''}">${dot(m.slots[p.id]!.color)}${s.crown!.holder === p.id ? '♛ ' : ''}${esc(m.slots[p.id]!.name)} <em>${Math.floor(p.crownT / TICK_HZ)}/${s.crown!.need / TICK_HZ}</em></div>`,
        )
        .join('');
    if (m.team)
      return TEAMS.map(
        (t, ti) =>
          `<div class="chip team" style="--tc:${t.color}">${esc(t.name.toUpperCase())} <em>${this.scores[ti] ?? 0}</em><span class="mates">${s.players
            .filter((p) => p.team === ti)
            .map((p) => `<b${p.alive ? '' : ' class="x"'}></b>`)
            .join('')}</span></div>`,
      ).join('');
    const pot = s.potato?.holder ?? null;
    return (
      s.players
        .map(
          (p) =>
            `<div class="chip${p.id === m.meId ? ' me' : ''}${p.alive ? '' : ' dead'}">${dot(m.slots[p.id]!.color)}${pot === p.id ? '💣 ' : ''}${p.id === m.meId ? 'YOU' : esc(m.slots[p.id]!.name)} <em>${this.scores[p.id] ?? 0}</em></div>`,
        )
        .join('') +
      (pot !== null ? `<div class="chip flag">POTATO ${Math.ceil(s.potato!.fuse / TICK_HZ)}s</div>` : '')
    );
  }

  /** Cronometrul din mijlocul barei: timpul rămas (dacă modul are limită), altfel timpul scurs. */
  private clockText(): string {
    const s = this.match!.s;
    if (this.match!.kind.type === 'infinite') return '∞';
    const mi = s.mission;
    const left =
      mi && mi.def.kind === 'race'
        ? mi.def.timeLimit * TICK_HZ - s.tick
        : s.rules.timeLimit
          ? s.rules.timeLimit - s.tick
          : null;
    const t = Math.max(0, Math.ceil((left ?? s.tick) / TICK_HZ));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  private updateHud(): void {
    const m = this.match!;
    const s = m.s;
    const me = m.me;
    const sec = (t: number) => Math.ceil(t / TICK_HZ);
    const onBomb = s.bombs.some(
      (b) => b.held === null && !b.fly && b.x === Math.round(me.px / U) && b.y === Math.round(me.py / U),
    );
    const box = (t: string, cls = '') => `<span class="box${cls ? ' ' + cls : ''}">${t}</span>`;
    const bombs = !me.alive
      ? ''
      : me.carry !== null
        ? box('THROW', 'on')
        : me.glove && onBomb
          ? box('LIFT', 'on')
          : `<span><span class="lbl">BOMBS </span><em>${me.bombs - me.active}/${me.bombs}</em></span>`;
    const lvl = Math.max(1, Math.round((me.speed - SPEED_START) / SPEED_STEP) + 1);
    const stats =
      bombs +
      `<span><span class="lbl">RANGE </span><em>${me.range}${me.range >= MAX_RANGE ? '★' : ''}</em></span>` +
      `<span><span class="lbl">SPEED </span><em>${lvl}${me.speed >= SPEED_MAX ? '★' : ''}</em></span>` +
      (me.bombs >= MAX_BOMBS ? box('8 BOMBS', 'on') : '') +
      (['kick', 'glove', 'remote', 'line'] as const)
        .map((a) =>
          me[a] ? box(`${ABILITY[a].toUpperCase()}${me.charges[a] ? ` ×${me.charges[a]}` : ''}`) : '',
        )
        .join('') +
      (me.revT > 0 ? box(`REVERSED ${sec(me.revT)}s`, 'bad') : '') +
      (me.dizzyT > 0 ? box(`DIZZY ${sec(me.dizzyT)}s`, 'bad') : '') +
      (me.hicT > 0 ? box(`HICCUPS ${sec(me.hicT)}s`, 'bad') : '') +
      (me.shieldT > 0 ? box(`SHIELD ${sec(me.shieldT)}s`, 'shield') : '') +
      (me.guard > 0 ? box('SHAWL', 'shield') : '') +
      (me.hexT > 0 ? box(`HEX ${sec(me.hexT)}s`, 'on') : '') +
      (me.frozenT > 0 ? box(`FROZEN ${sec(me.frozenT)}s`, 'bad') : '') +
      (me.blindT > 0 ? box(`BLIND ${sec(me.blindT)}s`, 'bad') : '');
    const heart =
      '<svg viewBox="0 0 24 22" class="heart" aria-hidden="true"><path d="M12 21 L2 10 a5.5 5.5 0 0 1 10 -5 a5.5 5.5 0 0 1 10 5z"/></svg>';
    const hearts =
      me.alive && (me.lives > 1 || s.rules.lives > 1 || s.rules.extras) && !s.mission
        ? `<span class="hearts" data-test="hearts" aria-label="${me.lives} lives" data-lives="${me.lives}">${heart.repeat(me.lives)}</span>`
        : '';
    const inf = m.kind.type === 'infinite';
    if (this.side.classList.contains('hidden') === inf) show(this.side, inf);
    if (inf && performance.now() - this.miniT > 200) {
      this.miniT = performance.now();
      this.drawMini();
    }
    const chips = this.chipsHtml();
    const clock = this.clockText();
    if (this.clock.textContent !== clock) this.clock.textContent = clock;
    const key = chips + hearts + stats;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.chips.innerHTML = chips;
    this.stats.innerHTML = hearts + stats;
  }

  private updateBubble(): void {
    const m = this.match!;
    const me = m.me;
    const doom = m.doom && me.alive && m.doom.t > 0.9;
    const hero = m.hero && m.hero.t > 0.25 ? m.hero : null;
    const on = !!(doom || hero);
    show(this.bubble, on);
    if (!on) return;
    const text = doom ? 'bye bye…' : hero!.text;
    if (this.bubble.textContent !== text) this.bubble.textContent = text;
    this.bubble.classList.toggle('hero', !doom);
    const p = doom ? me : m.s.players[hero!.player]!;
    let x: number;
    let y: number;
    if (this.view === '2d') {
      const [px, py] = m.lerp(`p${p.id}`, p.px, p.py);
      const pt = this.scene.toScreen(
        px + 0.5,
        py - (hero && (hero.kind === 'win' || hero.kind === 'team') ? 0.8 : 0.45),
      );
      x = pt.x;
      y = pt.y;
    } else {
      x = innerWidth / 2;
      y = innerHeight * 0.3;
    }
    this.bubble.style.left = `${Math.max(60, Math.min(innerWidth - 60, x))}px`;
    this.bubble.style.top = `${Math.max(70, y)}px`;
  }

  showBanner(text: string, ms = 1600, kind = ''): void {
    const b = this.banner;
    b.textContent = text;
    b.className = 'banner' + (kind ? ' ' + kind : '');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
  }

  private showToast(msg: string): void {
    const m = this.match;
    const again =
      m && m.s.rules.respawnTicks
        ? null
        : btn('main', 'NEW ROUND', () => this.restart(), { style: 'font-size:20px;min-height:44px' });
    this.toast.replaceChildren(h('span', {}, msg), again ?? '');
    show(this.toast, true);
    if (!again) setTimeout(() => show(this.toast, false), 2500);
  }
}
