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
  isGold,
  isNegative,
  missionGoal,
  missionStars,
} from '@fitil/sim';
import type { BotLevel, Dir, GameState, TutorialStep } from '@fitil/sim';
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
  HEROES,
  HERO_IDS,
  ITEM_NAMES,
  affinity,
  arenaEventById,
  MODES,
  MODE_IDS,
  QUIPS,
  TAUNTS,
  TEAMS,
  THEMES,
  TUTORIAL_TEXT,
  seasonalTheme,
  themeById,
} from '@fitil/content';
import type { HeroId, ModeId, Theme } from '@fitil/content';
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
import { currentTheme, save, settings } from './settings.ts';
import type { Quality, View } from './settings.ts';
import { $, h, show } from './ui/dom.ts';
import { maxHumans } from '@fitil/net';
import { OnlineSession } from './online/session.ts';

/** Build-ul demo (GitHub Pages) n-are server de joc: fără meniul Online (`VITE_OFFLINE_ONLY=1`). */
const OFFLINE_ONLY = import.meta.env.VITE_OFFLINE_ONLY === '1';

type Phase = 'menu' | 'play' | 'paused' | 'over';
const VIEWS: View[] = ['2d', 'fps', 'chase'];
const VIEW_LBL: Record<View, string> = { '2d': '2D view', fps: '1P view', chase: '3P view' };
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'insane'];

export class App {
  readonly sfx = new Sfx();
  readonly music = new Music(this.sfx);
  voice: VoicePack;
  private synth: SynthVoice;
  private voiceLoading = false;
  theme: Theme = currentTheme();
  match: Match | null = null;
  online: OnlineSession | null = null;
  private onlineErr = '';
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

  // elemente
  private ui = $('#ui');
  private chips!: HTMLElement;
  private stats!: HTMLElement;
  private viewBtn!: HTMLButtonElement;
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
    if (!OFFLINE_ONLY) void OnlineSession.resume().then((o) => o && !this.online && this.enterRoom(o));
  }

  /* ---------- DOM ---------- */

  private buildDom(): void {
    this.chips = h('div', { class: 'chips' });
    this.stats = h('div', { class: 'stats' });
    this.viewBtn = h(
      'button',
      { class: 'menu-btn', 'aria-label': 'Change view', onclick: () => this.cycleView() },
      '2D view',
    );
    this.menuBtn = h(
      'button',
      { class: 'menu-btn', 'aria-label': 'Menu, pause', onclick: () => this.togglePause() },
      '❚❚ Menu',
    );
    const bar = h(
      'div',
      { class: 'bar' },
      h('div', { class: 'logo' }, 'FI', h('span', {}, 'TIL')),
      this.chips,
      this.stats,
      this.viewBtn,
      this.menuBtn,
    );
    const left = h(
      'div',
      { class: 'zone left' },
      h('div', { class: 'joy-base hidden' }, h('div', { class: 'joy-knob' })),
    );
    const right = h('div', { class: 'zone right', 'aria-label': 'Bomb' });
    this.det = h('button', { class: 'det hidden', 'aria-label': 'Detonate' }, 'BOOM!');
    this.bomb3 = h('button', { class: 'bomb3 hidden', 'aria-label': 'Drop bomb' }, 'BOMB');
    this.sup = h('button', { class: 'sup hidden', 'aria-label': 'Super', 'data-test': 'super' }, 'SUPER');
    this.spec = h('button', { class: 'spec hidden', 'aria-label': 'Next special bomb' }, h('i'), h('b'));
    this.dark = h('div', { class: 'dark3 hidden' });
    this.hints = [
      h('div', { class: 'hint l' }, 'Left: move'),
      h('div', { class: 'hint r' }, h('i'), h('span', {}, 'Right: bomb')),
    ];
    this.overlay = h('div', { class: 'overlay' });
    this.drawer = h('div', { class: 'drawer hidden' });
    this.banner = h('div', { class: 'banner hidden' });
    this.bubble = h('div', { class: 'bubble hidden' });
    this.toast = h('div', { class: 'toast hidden' });
    this.tut = h('div', { class: 'tut hidden' });
    this.arrow = h('div', { class: 'obj-arrow hidden' }, h('b'), h('span'));
    this.ui.append(
      bar,
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
      this.overlay,
    );
  }

  private applyTheme(): void {
    const s = document.documentElement.style;
    s.setProperty('--ink', this.theme.ink);
    s.setProperty('--hot', this.theme.accent);
    s.setProperty('--hot-dark', this.theme.accentDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', this.theme.ink);
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
    this.hudKey = '';
  }

  private showScreen(fn: () => HTMLElement): void {
    this.screen = fn;
    this.overlay.replaceChildren(fn());
    show(this.overlay, true);
  }

  private hideOverlay(): void {
    show(this.overlay, false);
    this.overlay.replaceChildren();
  }

  private card(...children: (HTMLElement | string | null | false)[]): HTMLElement {
    return h('div', { class: 'card' }, ...children);
  }

  private back(to: () => HTMLElement = () => this.mainMenu()): HTMLElement {
    return h('button', { class: 'btn ghost', onclick: () => this.showScreen(to) }, 'Back');
  }

  /* ---------- ecrane ---------- */

  private mainMenu(): HTMLElement {
    const season = seasonalTheme(new Date());
    return this.card(
      h('h1', {}, 'FITIL'),
      h('p', {}, 'Bombs, chains, kicks and throws. Last one standing wins.'),
      h(
        'button',
        { class: 'btn', 'data-test': 'play', onclick: () => this.showScreen(() => this.playMenu()) },
        'Play',
      ),
      !OFFLINE_ONLY &&
        h(
          'button',
          { class: 'btn', 'data-test': 'online', onclick: () => this.showScreen(() => this.onlineMenu()) },
          'Online',
        ),
      h(
        'div',
        { class: 'grid four' },
        h(
          'button',
          {
            class: 'opt',
            'data-test': 'missions',
            onclick: () => this.showScreen(() => this.missionsMenu()),
          },
          'Missions',
        ),
        h(
          'button',
          {
            class: 'opt',
            'data-test': 'practice',
            onclick: () => this.showScreen(() => this.practiceMenu()),
          },
          'Practice',
        ),
        h('button', { class: 'opt', onclick: () => this.showScreen(() => this.themesMenu()) }, 'Themes'),
        h('button', { class: 'opt', onclick: () => this.showScreen(() => this.settingsMenu()) }, 'Settings'),
      ),
      season && h('p', {}, `Seasonal theme: ${season.name}`),
      h(
        'p',
        { class: 'rot' },
        matchMedia('(orientation: portrait) and (pointer: coarse)').matches
          ? 'Rotate your phone for a bigger screen.'
          : '',
      ),
    );
  }

  private missionsMenu(): HTMLElement {
    const stars = settings.stars;
    const starStr = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
    return this.card(
      h('h2', {}, 'Missions'),
      h('p', {}, 'Solo, with a health bar. Stars depend on your time and remaining health.'),
      ...CHAPTERS.flatMap((c, ci) => {
        const open = chapterUnlocked(ci, stars);
        const got = c.missions.reduce((n, id) => n + (stars[id] ?? 0), 0);
        return [
          h('h3', {}, `${c.name} · ${got}/${c.missions.length * 3}★`),
          open
            ? h(
                'div',
                { class: 'grid' },
                ...c.missions.map((id) => {
                  const def = missionById(id)!;
                  const ok = missionUnlocked(id, stars);
                  return h(
                    'button',
                    {
                      class: 'opt' + (ok ? '' : ' locked'),
                      'data-mission': id,
                      disabled: !ok,
                      title: def.desc,
                      onclick: () => this.start({ type: 'mission', id }),
                    },
                    ok ? def.name : `🔒 ${def.name}`,
                    h('span', { class: 'stars' }, starStr(stars[id] ?? 0)),
                  );
                }),
              )
            : h('p', {}, `🔒 Unlocks with ${c.unlockStars}★ in the previous chapter.`),
        ];
      }),
      this.back(),
    );
  }

  private modeGrid(onPick: (m: ModeId) => void): HTMLElement {
    return h(
      'div',
      { class: 'grid' },
      ...MODE_IDS.map((m) =>
        h(
          'button',
          {
            class: 'opt',
            'aria-pressed': String(this.kind.type === 'mode' && this.kind.mode === m),
            'data-mode': m,
            onclick: () => onPick(m),
          },
          MODES[m].name,
        ),
      ),
    );
  }

  private levelGrid(): HTMLElement {
    return h(
      'div',
      { class: 'grid four' },
      ...LEVELS.map((l) =>
        h(
          'button',
          {
            class: 'opt',
            'aria-pressed': String(settings.bots === l),
            onclick: () => {
              settings.bots = l;
              save();
              this.showScreen(this.screen);
            },
          },
          BOT_NAMES[l],
        ),
      ),
    );
  }

  /** Butonul cu personajul curent (deschide selecția). `back` = ecranul la care revii. */
  private heroButton(cur: HeroId, back: () => HTMLElement, set: (id: HeroId) => void): HTMLElement {
    const hero = HEROES[cur];
    return h(
      'button',
      {
        class: 'opt hero-pick',
        'data-test': 'hero',
        style: `--hc:${hero.color}`,
        onclick: () => this.showScreen(() => this.heroMenu(cur, back, set)),
      },
      h('i', { class: 'av' }),
      `${hero.name} — ${hero.superName}`,
      h('span', {}, ' ▸'),
    );
  }

  /** Selecția personajului: raritate, pasiv, Super și afinitatea cu tema curentă. */
  private heroMenu(cur: HeroId, back: () => HTMLElement, set: (id: HeroId) => void): HTMLElement {
    const theme = this.theme;
    return this.card(
      h('h2', {}, 'Choose a hero'),
      h('p', {}, `Arena: ${theme.name}. Green and red notes are this arena’s bonus or penalty.`),
      h(
        'div',
        { class: 'heroes' },
        ...HERO_IDS.map((id) => {
          const hd = HEROES[id];
          const aff = affinity(id, theme.id);
          const minus =
            aff && ((aff.speedPct ?? 100) < 100 || (aff.superPct ?? 100) < 100 || (aff.range ?? 0) < 0);
          return h(
            'button',
            {
              class: 'hero-card',
              style: `--hc:${hd.color}`,
              'data-hero': id,
              'aria-pressed': String(id === cur),
              onclick: () => {
                set(id);
                this.showScreen(back);
              },
            },
            h('i', { class: 'av' }),
            h('b', {}, hd.name),
            h('small', {}, hd.rarity),
            h('p', {}, h('strong', {}, `${hd.superName}: `), hd.superText),
            h('p', {}, hd.passiveText),
            aff && h('p', { class: minus ? 'aff minus' : 'aff' }, aff.text),
          );
        }),
      ),
      this.back(back),
    );
  }

  private playMenu(): HTMLElement {
    if (this.kind.type !== 'mode') this.kind = { type: 'mode', mode: settings.mode };
    const mode = this.kind.mode;
    return this.card(
      h('h2', {}, 'Choose a mode'),
      h('h3', {}, 'Hero'),
      this.heroButton(
        settings.hero,
        () => this.playMenu(),
        (id) => {
          settings.hero = id;
          save();
        },
      ),
      this.modeGrid((m) => {
        this.kind = { type: 'mode', mode: m };
        settings.mode = m;
        save();
        this.showScreen(() => this.playMenu());
      }),
      h('p', {}, MODES[mode].desc),
      h('h3', {}, 'Bots'),
      this.levelGrid(),
      h(
        'button',
        { class: 'btn', 'data-test': 'start', onclick: () => this.start({ type: 'mode', mode }) },
        'Start',
      ),
      this.legend(),
      this.back(),
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
    });
    const code = h('input', {
      class: 'field code',
      'data-test': 'code',
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
        this.showScreen(() => this.onlineMenu());
      }
    };
    const quickMode = this.kind.type === 'mode' ? this.kind.mode : settings.mode;
    return this.card(
      h('h2', {}, 'Online'),
      name,
      h('h3', {}, 'Hero'),
      this.heroButton(
        settings.hero,
        () => this.onlineMenu(),
        (id) => {
          settings.hero = id;
          save();
        },
      ),
      h('h3', {}, 'Quick play'),
      h('p', {}, 'Join a public match. It starts when the room is full, or after 15s with bots.'),
      this.modeGrid((m) => {
        this.kind = { type: 'mode', mode: m };
        settings.mode = m;
        save();
        this.showScreen(() => this.onlineMenu());
      }),
      h(
        'button',
        {
          class: 'btn',
          'data-test': 'quick',
          onclick: () => go(() => OnlineSession.quick(quickMode, name.value, settings.hero, this.aspect())),
        },
        `Quick play: ${MODES[quickMode].name}`,
      ),
      h('h3', {}, 'Private room'),
      h('p', {}, 'Play with friends. Empty seats are filled with bots.'),
      h(
        'button',
        {
          class: 'btn',
          'data-test': 'create',
          onclick: () => go(() => OnlineSession.create(name.value, settings.hero)),
        },
        'Create a room',
      ),
      h(
        'div',
        { class: 'row' },
        code,
        h(
          'button',
          {
            class: 'btn',
            'data-test': 'join',
            onclick: () => {
              if (/^[a-z]{4}$/i.test(code.value))
                void go(() => OnlineSession.join(code.value, name.value, settings.hero));
            },
          },
          'Join',
        ),
      ),
      this.onlineErr && h('p', { class: 'err' }, this.onlineErr),
      this.back(),
    );
  }

  private enterRoom(o: OnlineSession): void {
    this.online = o;
    o.net.onLobby = () => {
      if (this.online === o && this.phase === 'menu' && !this.match)
        this.showScreen(() => this.lobbyScreen());
    };
    o.net.onSnap = () => {
      if (this.online === o && this.match?.net !== o.net) this.startOnline(o);
    };
    o.onStatus = (st, reason) => {
      if (this.online !== o) return;
      if (st === 'reconnecting') this.showBanner('Connection lost, reconnecting…', 15000);
      if (st === 'online') this.showBanner('Reconnected', 1400);
      if (st === 'closed') {
        this.online = null;
        this.onlineErr = reason && !/consent/i.test(reason) ? reason : 'Disconnected from the room.';
        this.toMenu();
        this.showScreen(() => this.onlineMenu());
      }
    };
    this.showScreen(() => this.lobbyScreen());
  }

  private lobbyScreen(): HTMLElement {
    const o = this.online;
    if (!o) return this.onlineMenu();
    const l = o.net.lobby;
    const host = o.isHost;
    const cfg = l?.cfg;
    const pick = (
      attr: string,
      items: readonly string[],
      cur: string | undefined,
      name: (v: string) => string,
      set: (v: string) => void,
    ) =>
      h(
        'div',
        { class: items.length > 7 ? 'grid three' : items.length > 4 ? 'grid' : 'grid four' },
        ...items.map((v) =>
          h(
            'button',
            {
              class: 'opt',
              [attr]: v,
              'aria-pressed': String(v === cur),
              disabled: !host,
              onclick: () => set(v),
            },
            name(v),
          ),
        ),
      );
    const quick = !!l?.quick;
    const mine = l?.seats.find((x) => x.sid === o.room.sessionId);
    const config = !quick;
    return this.card(
      quick
        ? h('h2', {}, `Quick play: ${cfg ? MODES[cfg.mode].name : ''}`)
        : h('h2', {}, 'Room ', h('span', { class: 'room-code', 'data-test': 'room-code' }, o.code)),
      h(
        'p',
        { 'data-test': 'lobby-status' },
        quick
          ? l?.startIn != null
            ? `Starting in ${l.startIn}s… Bots fill the empty seats.`
            : 'Waiting for players…'
          : host
            ? 'Share the code with your friends, then press Start.'
            : 'Waiting for the host to start…',
      ),
      h('h3', {}, 'Your hero'),
      this.heroButton(
        mine?.hero ?? settings.hero,
        () => this.lobbyScreen(),
        (id) => {
          settings.hero = id;
          save();
          o.setHero(id);
        },
      ),
      h(
        'ul',
        { class: 'seats' },
        ...(l?.seats ?? []).map((st, i) =>
          h(
            'li',
            { class: st.connected ? '' : 'off' },
            st.name,
            h('small', {}, ` · ${HEROES[st.hero]?.name ?? ''}`),
            i === 0 && !quick ? h('small', {}, ' host') : null,
            st.sid === o.room.sessionId ? h('small', {}, ' (you)') : null,
          ),
        ),
      ),
      !!cfg &&
        !!l &&
        l.seats.length > l.max &&
        h('p', { class: 'err' }, `${MODES[cfg.mode].name} takes only ${l.max} players.`),
      config && h('h3', {}, 'Mode'),
      config &&
        pick(
          'data-mode',
          MODE_IDS,
          cfg?.mode,
          (v) => MODES[v as ModeId].name,
          (v) => o.setCfg({ mode: v as ModeId }),
        ),
      !!cfg &&
        h(
          'p',
          {},
          MODES[cfg.mode].desc.replace(
            /^You against [^.]*\. ?/,
            `Up to ${maxHumans(cfg.mode)} players, bots fill the rest. `,
          ),
        ),
      config && h('h3', {}, 'Bots'),
      config &&
        pick(
          'data-level',
          LEVELS,
          cfg?.bots,
          (v) => BOT_NAMES[v as BotLevel],
          (v) => o.setCfg({ bots: v as BotLevel }),
        ),
      config && h('h3', {}, 'Theme'),
      config &&
        pick(
          'data-theme',
          THEMES.map((t) => t.id),
          cfg?.theme,
          (v) => themeById(v).name,
          (v) => o.setCfg({ theme: v }),
        ),
      config && h('h3', {}, 'Arena events & new power-ups'),
      config &&
        pick(
          'data-extras',
          ['on', 'off'],
          cfg?.extras === false ? 'off' : 'on',
          (v) => (v === 'on' ? 'On' : 'Off'),
          (v) => o.setCfg({ extras: v === 'on' }),
        ),
      host &&
        config &&
        h('button', { class: 'btn', 'data-test': 'start', onclick: () => o.start(this.aspect()) }, 'Start'),
      h(
        'button',
        {
          class: 'btn ghost',
          onclick: () => {
            this.leaveOnline();
            this.showScreen(() => this.onlineMenu());
          },
        },
        'Leave room',
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
    this.startBanners(m.s);
    if (o.lag)
      this.showBanner(
        `Simulated lag ${o.lag.rtt} ms ±${o.lag.jitter}, loss ${Math.round(o.lag.loss * 100)}%`,
        2600,
      );
  }

  private legend(): HTMLElement {
    const it = (b: string, t: string, c?: string) =>
      h('span', {}, h('b', c ? { style: `color:${c}` } : {}, b), ' ' + t);
    return h(
      'div',
      { class: 'legend' },
      it('Glove', 'double tap: drop and pick up a bomb; tap: throw it over walls'),
      it('Kick', 'walk into a bomb to kick it'),
      it('Portal', 'opens for 15s after a chain of 4+ bombs'),
      it('Red border with −', 'bad power-up, avoid it', '#ff6b6b'),
      it('Gold crate', 'guaranteed max power-up', '#ffd23f'),
      it('Cracked purple crate', 'curse: spiders or lightning clouds', '#c78bff'),
      it('Shield', '10s; saves you from one blast', '#4fd8ff'),
      it('Detonator', 'your bombs blow up when you press BOOM!'),
      it('Line', 'double tap: all your bombs in a line'),
    );
  }

  private practiceMenu(): HTMLElement {
    const done = new Set(settings.challenges);
    return this.card(
      h('h2', {}, 'Practice'),
      h('h3', {}, 'Interactive tutorial'),
      h(
        'button',
        {
          class: 'btn',
          'data-test': 'tutorial',
          onclick: () => this.start({ type: 'tutorial', step: 'move' }),
        },
        settings.tutorialDone ? 'Tutorial ✓ (replay)' : 'Tutorial — 6 steps',
      ),
      h('h3', {}, 'Training'),
      h(
        'div',
        { class: 'grid' },
        h(
          'button',
          { class: 'opt', 'data-test': 'dummies', onclick: () => this.start({ type: 'dummies' }) },
          'Dummies',
          h('small', {}, 'stationary targets'),
        ),
        h(
          'button',
          { class: 'opt', 'data-test': 'bots', onclick: () => this.showScreen(() => this.playMenu()) },
          'Against bots',
          h('small', {}, BOT_NAMES[settings.bots]),
        ),
      ),
      h('h3', {}, 'Challenges'),
      h(
        'div',
        { class: 'grid' },
        ...CHALLENGES.map((c) =>
          h(
            'button',
            {
              class: 'opt',
              'data-challenge': c,
              title: CHALLENGE_TEXT[c].desc,
              onclick: () => this.start({ type: 'challenge', id: c }),
            },
            CHALLENGE_TEXT[c].name,
            h(
              'small',
              { class: done.has(c) ? 'now' : '' },
              done.has(c) ? '✓ completed' : CHALLENGE_TEXT[c].desc.slice(0, 38) + '…',
            ),
          ),
        ),
      ),
      this.back(),
    );
  }

  private themeGrid(onPick: (id: string) => void): HTMLElement {
    const season = seasonalTheme(new Date())?.id;
    return h(
      'div',
      { class: 'grid three' },
      ...THEMES.map((t) =>
        h(
          'button',
          {
            class: 'opt',
            'aria-pressed': String(t.id === this.theme.id),
            'data-theme': t.id,
            onclick: () => onPick(t.id),
          },
          h(
            'span',
            { class: 'sw' },
            ...[t.ink, t.accent, t.flame[1], t.portal].map((c) =>
              h('i', { style: `background:${c};outline:1px solid #555` }),
            ),
          ),
          t.name,
          t.id === season
            ? h('small', { class: 'now' }, 'season')
            : t.season
              ? h('small', {}, 'event')
              : null,
        ),
      ),
    );
  }

  private themesMenu(): HTMLElement {
    return this.card(
      h('h2', {}, 'Themes'),
      this.themeGrid((id) => {
        this.setTheme(id);
        this.showScreen(() => this.themesMenu());
      }),
      this.back(),
    );
  }

  private toggle(label: string, on: boolean, fn: () => void): HTMLElement {
    return h(
      'button',
      {
        class: 'icon-btn',
        'aria-pressed': String(on),
        onclick: () => {
          fn();
          save();
          this.showScreen(this.screen);
        },
      },
      `${label}: ${on ? 'on' : 'off'}`,
    );
  }

  private settingsMenu(): HTMLElement {
    const Q: [Quality, string][] = [
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
    ];
    return this.card(
      h('h2', {}, 'Settings'),
      h(
        'div',
        { class: 'row', style: 'justify-content:center' },
        this.toggle('Sound', settings.sound, () => {
          settings.sound = !settings.sound;
          this.applyAudio();
        }),
        this.toggle('Music', settings.music, () => {
          settings.music = !settings.music;
          this.applyAudio();
        }),
        this.toggle('Vibration', settings.vibration, () => (settings.vibration = !settings.vibration)),
        this.toggle('Motion effects', settings.motion, () => {
          settings.motion = !settings.motion;
          this.scene.motion = settings.motion;
        }),
      ),
      h('h3', {}, '3D graphics quality'),
      h(
        'div',
        { class: 'grid three' },
        ...Q.map(([q, l]) =>
          h(
            'button',
            {
              class: 'opt',
              'aria-pressed': String(settings.quality === q),
              onclick: () => {
                settings.quality = q;
                save();
                this.r3?.setQuality(q);
                this.showScreen(this.screen);
              },
            },
            l,
          ),
        ),
      ),
      h('h3', {}, 'View'),
      h(
        'div',
        { class: 'grid three' },
        ...VIEWS.map((v) =>
          h(
            'button',
            {
              class: 'opt',
              'aria-pressed': String(settings.view === v),
              onclick: () => {
                settings.view = v;
                save();
                this.setView(v, false);
                this.showScreen(this.screen);
              },
            },
            VIEW_LBL[v].replace(' view', ''),
          ),
        ),
      ),
      h('p', {}, 'Keyboard: arrows / WASD, Space = bomb, E = BOOM!, V = view, P = pause.'),
      this.back(),
    );
  }

  private pauseDrawer(): HTMLElement[] {
    if (this.online)
      return [
        h('h2', {}, 'Menu'),
        h('p', {}, 'The match keeps going online — your character stands still.'),
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            { class: 'btn', 'data-test': 'resume', onclick: () => this.resume() },
            'Back to the match',
          ),
          h('button', { class: 'icon-btn', onclick: () => this.toMenu() }, 'Leave room'),
        ),
      ];
    return [
      h('h2', {}, 'Paused'),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn', 'data-test': 'resume', onclick: () => this.resume() }, 'Resume'),
        h('button', { class: 'icon-btn', onclick: () => this.restart() }, 'New round'),
      ),
      h('h3', {}, 'Mode (restarts the round)'),
      this.modeGrid((m) => {
        settings.mode = m;
        save();
        show(this.drawer, false);
        this.start({ type: 'mode', mode: m });
      }),
      h('h3', {}, 'Theme'),
      this.themeGrid((id) => {
        this.setTheme(id);
        this.drawer.replaceChildren(...this.pauseDrawer());
      }),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'icon-btn',
            onclick: (e) => {
              settings.sound = !settings.sound;
              save();
              this.applyAudio();
              (e.target as HTMLElement).textContent = `Sound: ${settings.sound ? 'on' : 'off'}`;
            },
          },
          `Sound: ${settings.sound ? 'on' : 'off'}`,
        ),
        h(
          'button',
          {
            class: 'icon-btn',
            onclick: (e) => {
              settings.music = !settings.music;
              save();
              this.applyAudio();
              (e.target as HTMLElement).textContent = `Music: ${settings.music ? 'on' : 'off'}`;
            },
          },
          `Music: ${settings.music ? 'on' : 'off'}`,
        ),
        h('button', { class: 'icon-btn', onclick: () => this.toMenu() }, 'Main menu'),
      ),
    ];
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
    const w = innerWidth;
    const hgt = innerHeight - 30;
    return Math.max(0.3, w / Math.max(1, hgt));
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
    this.beginPlay();
    const sameKind = JSON.stringify(kind) === JSON.stringify(this.kind);
    this.kind = kind;
    if (!sameKind || !this.match) this.scores = [];
    const m = Match.offline(kind, settings.bots, this.seedN++, this.aspect(), this.control(), {
      theme: this.theme.id,
      hero: settings.hero,
    });
    if (!this.scores.length) this.scores = m.team ? [0, 0] : m.slots.map(() => 0);
    this.attach(m);
    if (kind.type === 'mode') this.startBanners(m.s);
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
  private startBanners(s: GameState): void {
    const ev = arenaEventById(s.rules.event);
    const items = s.rules.startItems.length
      ? 'Starting with: ' + s.rules.startItems.map((i) => ITEM_NAMES[i]).join(' · ')
      : '';
    const event = ev && ev.id !== 'calm' ? `${ev.name}: ${ev.desc}` : '';
    if (items) setTimeout(() => this.showBanner(items, 2600), 60);
    if (event) setTimeout(() => this.showBanner(event, 2400, 'gold'), items ? 2700 : 60);
  }

  restart(): void {
    if (this.online) return;
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
    this.match = null;
    this.scene.setMatch(null);
    this.r3?.setMatch(null);
    this.phase = 'menu';
    this.controls.enabled = false;
    this.music.playing = false;
    show(this.drawer, false);
    show(this.toast, false);
    show(this.tut, false);
    show(this.bubble, false);
    this.showScreen(() => this.mainMenu());
  }

  private pause(): void {
    if (this.phase !== 'play' || !this.match) return;
    this.phase = 'paused';
    this.match.paused = true;
    this.controls.enabled = false;
    this.controls.reset();
    this.drawer.replaceChildren(...this.pauseDrawer());
    show(this.drawer, true);
  }

  private resume(): void {
    if (this.phase !== 'paused' || !this.match) return;
    show(this.drawer, false);
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
    if (sp) sp.textContent = v === '2d' ? 'Right: bomb' : 'Right: swipe to look around';
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
    if (this.view !== '2d') this.r3?.render(dt);
  }

  /** Butonul Super (inelul de încărcare) și bomba specială următoare (pe buton și pe BOMB în 3D). */
  private updateButtons(): void {
    const me = this.match!.me;
    const play = this.phase === 'play' && me.alive;
    const hero = me.hero ? HEROES[me.hero.id as HeroId] : null;
    show(this.sup, play && !!hero);
    if (hero) {
      const pct = Math.round((100 * me.charge) / SUPER_FULL);
      this.sup.style.setProperty('--c', `${pct}%`);
      this.sup.style.setProperty('--hc', hero.color);
      this.sup.classList.toggle('ready', pct >= 100);
      const label = pct >= 100 ? hero.superName : `${pct}%`;
      if (this.sup.textContent !== label) this.sup.textContent = label;
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
      const b = this.spec.querySelector('b')!;
      if (b.textContent !== `×${n}`) b.textContent = `×${n}`;
      this.spec.classList.toggle(
        'more',
        me.specials.some((k) => k !== next),
      );
    }
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
        const hd = m.slots[e.player]?.hero ? HEROES[m.slots[e.player]!.hero!] : null;
        this.sfx.win();
        if (mine(e.player)) vibrate([30, 30, 60]);
        if (hd)
          this.showBanner(
            `${mine(e.player) ? 'You' : m.slots[e.player]!.name}: ${hd.superName}!`,
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
        this.voice.scream(slot?.voice ?? 0);
        const bot = m.s.players[e.player]!.bot !== null;
        if (!bot || Math.random() < 0.5)
          this.voice.say(QUIPS[Math.floor(Math.random() * QUIPS.length)]!, 1.1 + (slot?.voice ?? 0) * 0.25);
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
    this.showScreen(() =>
      this.card(
        h('h2', {}, won ? 'Mission complete!' : 'Mission failed'),
        h('p', {}, won ? def.name : MISSION_END[mi.over?.reason === 'time' ? 'time' : 'dead']),
        h(
          'div',
          { class: 'bigstars', 'data-stars': String(stars) },
          ...[1, 2, 3].map((i) => h('span', { class: i <= stars ? 'on' : '' }, '★')),
        ),
        h('p', {}, `Time ${t}s · Health ${hp}%`),
        h('p', { style: 'font-size:12px' }, crit),
        h(
          'button',
          { class: 'btn', 'data-test': 'again', onclick: () => this.restart() },
          won ? 'Play again' : 'Try again',
        ),
        canNext
          ? h(
              'button',
              { class: 'btn ghost', onclick: () => this.start({ type: 'mission', id: next! }) },
              'Next mission',
            )
          : null,
        h(
          'button',
          { class: 'btn ghost', onclick: () => this.showScreen(() => this.missionsMenu()) },
          'Mission map',
        ),
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
    const R = Math.min(innerWidth, innerHeight - 30) * 0.38;
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
      this.showScreen(() =>
        this.card(
          h('h2', {}, 'Tutorial complete!'),
          h('p', {}, 'You know it all: moving, bombs, power-ups, kick, glove. Now for real!'),
          h(
            'button',
            { class: 'btn', onclick: () => this.start({ type: 'mode', mode: 'ffa' }) },
            'Play against bots',
          ),
          h('button', { class: 'btn ghost', onclick: () => this.toMenu() }, 'Menu'),
        ),
      );
    }, 900);
  }

  private challengeOver(ok: boolean): void {
    const k = this.kind;
    if (k.type !== 'challenge') return;
    if (ok && !settings.challenges.includes(k.id)) {
      settings.challenges.push(k.id);
      save();
    }
    if (ok) this.sfx.win();
    setTimeout(
      () => {
        if (this.kind !== k) return;
        this.phase = 'over';
        this.controls.enabled = false;
        this.showScreen(() =>
          this.card(
            h('h2', {}, ok ? 'Challenge complete!' : 'Challenge failed'),
            h('p', {}, `${CHALLENGE_TEXT[k.id].name}: ${CHALLENGE_TEXT[k.id].desc}`),
            h('button', { class: 'btn', onclick: () => this.restart() }, ok ? 'Play again' : 'Try again'),
            h(
              'button',
              { class: 'btn ghost', onclick: () => this.showScreen(() => this.practiceMenu()) },
              'More challenges',
            ),
          ),
        );
      },
      ok ? 1600 : 900,
    );
  }

  private roundOver(e: Extract<MatchEvent, { type: 'over' }>): void {
    const m = this.match;
    if (!m || m.kind.type === 'challenge' || m.kind.type === 'tutorial') return;
    if (m.kind.type === 'mission') return this.missionOver();
    this.phase = 'over';
    this.controls.enabled = false;
    show(this.toast, false);
    let title: string;
    let msg: string;
    if (m.team) {
      if (e.team !== null) this.scores[e.team]!++;
      const mine = e.team === m.me.team;
      title = e.team === null ? 'Draw' : mine ? 'Your team won!' : `${TEAMS[e.team]!.name} team wins`;
      msg = m.s.ctf
        ? `Captures: ${TEAMS[0].name} ${m.s.ctf.caps[0]} – ${m.s.ctf.caps[1]} ${TEAMS[1].name}`
        : e.team === null
          ? 'Nobody is left standing.'
          : mine
            ? 'Teamwork. One more?'
            : 'Next time, a bit more coordination.';
    } else if (e.winner !== null) {
      this.scores[e.winner]!++;
      const w = m.slots[e.winner]!;
      if (e.winner === m.meId) {
        title = 'You won!';
        msg = 'The arena is yours. One more?';
      } else {
        title = `${w.name} wins`;
        msg = `${w.name} dances on the ruins.`;
        this.voice.say(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]!, 1.2 + w.voice * 0.25);
      }
    } else {
      title = 'Draw';
      msg = 'Everybody blew up. Nice.';
    }
    this.hudKey = '';
    this.showScreen(() =>
      this.card(
        h('h2', {}, title),
        h('p', {}, msg),
        this.scoreRow(),
        this.online
          ? h(
              'button',
              { class: 'btn', 'data-test': 'lobby', onclick: () => this.toLobby() },
              'Back to the room',
            )
          : h('button', { class: 'btn', 'data-test': 'again', onclick: () => this.restart() }, 'Next round'),
        h(
          'button',
          { class: 'btn ghost', onclick: () => this.toMenu() },
          this.online ? 'Leave room' : 'Menu',
        ),
      ),
    );
  }

  /* ---------- HUD ---------- */

  private scoreRow(): HTMLElement {
    const row = h('div', { class: 'score-row' });
    row.innerHTML = this.chipsHtml();
    return row;
  }

  private chipsHtml(): string {
    const m = this.match!;
    const s = m.s;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const col = (c: string) => this.theme.tint[c] ?? c;
    if (m.kind.type === 'tutorial')
      return `<div class="chip">Tutorial ${TUTORIAL_STEPS.indexOf(m.kind.step) + 1}/6</div>`;
    if (s.mission) {
      const mi = s.mission;
      const hp = Math.round(m.me.hp);
      const c = hp > 60 ? '#7dffb0' : hp > 30 ? '#ffd23f' : '#ff5a4d';
      const t = Math.floor(s.tick / TICK_HZ);
      const obj =
        mi.def.kind === 'race'
          ? `Time ${Math.max(0, mi.def.timeLimit - t)}s`
          : `${esc(missionById(mi.def.id)?.name ?? '')} ${mi.count}/${mi.need}`;
      return (
        `<div class="life" data-hp="${hp}"><i style="width:${hp}%;background:${c}"></i><span>${hp}%</span></div>` +
        `<div class="chip">${obj}</div>` +
        (mi.def.kind !== 'race' ? `<div class="chip">${t}s</div>` : '')
      );
    }
    if (m.challenge) {
      const c = m.challenge;
      const t = Math.floor(s.tick / TICK_HZ);
      return `<div class="chip">${esc(CHALLENGE_TEXT[c.id].name)} ${c.count}/${c.need}</div><div class="chip">${t}s</div>`;
    }
    if (m.kind.type === 'dummies')
      return `<div class="chip"><i style="background:${col(m.slots[0]!.color)}"></i>Eliminations ${this.scores[0] ?? 0}</div>`;
    if (s.ctf) {
      const left = Math.max(0, Math.ceil((s.rules.timeLimit - s.tick) / TICK_HZ));
      return (
        TEAMS.map(
          (t, i) =>
            `<div class="chip"><i style="background:${t.color}"></i>${t.name} ${s.ctf!.caps[i]}/${s.ctf!.need}${s.ctf!.flags[i]!.atHome ? '' : ' ⚑!'}</div>`,
        ).join('') + `<div class="chip">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div>`
      );
    }
    if (s.crown) {
      const left = Math.max(0, Math.ceil((s.rules.timeLimit - s.tick) / TICK_HZ));
      return (
        s.players
          .map(
            (p) =>
              `<div class="chip${s.crown!.holder === p.id ? ' on' : ''}"><i style="background:${col(m.slots[p.id]!.color)}"></i>${s.crown!.holder === p.id ? '♛ ' : ''}${esc(m.slots[p.id]!.name)} ${Math.floor(p.crownT / TICK_HZ)}/${s.crown!.need / TICK_HZ}s</div>`,
          )
          .join('') + `<div class="chip">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div>`
      );
    }
    if (m.team)
      return TEAMS.map(
        (t, ti) =>
          `<div class="chip"><i style="background:${t.color}"></i>${t.name} ${this.scores[ti] ?? 0}<span class="mates">${s.players
            .filter((p) => p.team === ti)
            .map(
              (p) => `<b style="background:${col(m.slots[p.id]!.color)}"${p.alive ? '' : ' class="x"'}></b>`,
            )
            .join('')}</span></div>`,
      ).join('');
    const pot = s.potato?.holder ?? null;
    return (
      s.players
        .map(
          (p) =>
            `<div class="chip${p.alive ? '' : ' dead'}"><i style="background:${col(m.slots[p.id]!.color)}"></i>${pot === p.id ? '💣 ' : ''}${esc(m.slots[p.id]!.name)} ${this.scores[p.id] ?? 0}</div>`,
        )
        .join('') +
      (pot !== null ? `<div class="chip">Potato ${Math.ceil(s.potato!.fuse / TICK_HZ)}s</div>` : '')
    );
  }

  private updateHud(): void {
    const m = this.match!;
    const s = m.s;
    const me = m.me;
    const sec = (t: number) => Math.ceil(t / TICK_HZ);
    const onBomb = s.bombs.some(
      (b) => b.held === null && !b.fly && b.x === Math.round(me.px / U) && b.y === Math.round(me.py / U),
    );
    const bombs = !me.alive
      ? ''
      : me.carry !== null
        ? '<b class="on">Throw</b>'
        : me.glove && onBomb
          ? '<b class="on">Lift</b>'
          : `<span class="lbl">Bombs </span><b>${me.bombs - me.active}/${me.bombs}</b>`;
    const lvl = Math.max(1, Math.round((me.speed - SPEED_START) / SPEED_STEP) + 1);
    const stats =
      `<span>${bombs}</span><span><span class="lbl">Range </span><b>${me.range}${me.range >= MAX_RANGE ? '★' : ''}</b></span><span><span class="lbl">Speed </span><b>${lvl}${me.speed >= SPEED_MAX ? '★' : ''}</b></span>` +
      (me.bombs >= MAX_BOMBS ? '<span class="on">8 bombs</span>' : '') +
      (me.kick ? '<span class="on">Kick</span>' : '') +
      (me.glove ? '<span class="on">Glove</span>' : '') +
      (me.remote ? '<span class="on">Detonator</span>' : '') +
      (me.line ? '<span class="on">Line</span>' : '') +
      (me.revT > 0 ? `<span class="bad">Reversed ${sec(me.revT)}s</span>` : '') +
      (me.dizzyT > 0 ? `<span class="bad">Dizzy ${sec(me.dizzyT)}s</span>` : '') +
      (me.hicT > 0 ? `<span class="bad">Hiccups ${sec(me.hicT)}s</span>` : '') +
      (me.shieldT > 0 ? `<span class="shield">Shield ${sec(me.shieldT)}s</span>` : '') +
      (me.guard > 0 ? '<span class="shield">Shawl</span>' : '') +
      (me.hexT > 0 ? `<span class="on">Hex ${sec(me.hexT)}s</span>` : '') +
      (me.frozenT > 0 ? `<span class="bad">Frozen ${sec(me.frozenT)}s</span>` : '') +
      (me.blindT > 0 ? `<span class="bad">Blind ${sec(me.blindT)}s</span>` : '');
    const hearts =
      me.alive && (me.lives > 1 || s.rules.lives > 1 || s.rules.extras) && !s.mission
        ? `<span class="hearts" data-test="hearts">${'♥'.repeat(me.lives)}</span>`
        : '';
    const chips = this.chipsHtml();
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
    const btn =
      m && m.s.rules.respawnTicks
        ? null
        : h('button', { class: 'btn', onclick: () => this.restart() }, 'New round');
    this.toast.replaceChildren(h('span', {}, msg), btn ?? '');
    show(this.toast, true);
    if (!btn) setTimeout(() => show(this.toast, false), 2500);
  }
}
