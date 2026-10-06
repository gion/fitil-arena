import { Room, ServerError } from '@colyseus/core';
import type { Client, Delayed } from '@colyseus/core';
import { TICK_MS } from '@fitil/sim';
import { MODE_IDS, THEMES, seasonalTheme } from '@fitil/content';
import type { ModeId } from '@fitil/content';
import { ArenaHost, CODE_LETTERS, RECONNECT_S } from '@fitil/net';
import type { InputMsg, MeMsg, RoomCfg } from '@fitil/net';

/** Joc rapid: cât așteaptă camera alți jucători înainte să pornească cu boți. */
const QUICK_WAIT_MS = 15_000;

/** Codurile camerelor active (4 litere, fără I și O). */
const codes = new Set<string>();

function newCode(): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
    if (!codes.has(c)) return c;
  }
}

interface CreateOpts {
  /** Doar în dezvoltare/teste: tick mai rapid ca meciurile să se termine repede. */
  tickMs?: number;
  /** Cameră publică de joc rapid (definită ca `quick`, filtrată după `mode`). */
  quick?: boolean;
  mode?: string;
  /** Doar în dezvoltare/teste: cât așteaptă jocul rapid înainte să pornească. */
  waitMs?: number;
}

interface JoinOpts extends MeMsg {
  aspect?: number;
}

/** Tema jocului rapid: cea de sezon, altfel una de bază la întâmplare. */
function quickTheme(): string {
  const season = seasonalTheme(new Date());
  if (season) return season.id;
  const base = THEMES.filter((t) => !t.season);
  return base[Math.floor(Math.random() * base.length)]!.id;
}

/**
 * Camera privată: ține un `ArenaHost` (logica) și îl leagă de Colyseus — mesaje, tick la 20 Hz,
 * reconectare în 15s. Codul camerei e chiar `roomId`, deci clientul intră cu `joinById(cod)`.
 */
export class ArenaRoom extends Room {
  override maxClients = 4;
  private arena!: ArenaHost;
  private tickMs = TICK_MS;
  private acc = 0;
  private waitMs = QUICK_WAIT_MS;
  private countdown: Delayed | null = null;
  /** Proporția ecranului primului jucător (jocul rapid n-are o gazdă care apasă Start). */
  private aspect = 16 / 9;

  override onCreate(opts: CreateOpts = {}): void {
    const code = newCode();
    codes.add(code);
    this.roomId = code;
    const dev = process.env.NODE_ENV !== 'production';
    const mode = (MODE_IDS as readonly string[]).includes(opts.mode ?? '') ? (opts.mode as ModeId) : 'ffa';
    this.arena = new ArenaHost(code, opts.quick ? { mode, theme: quickTheme() } : null);
    if (dev && opts.tickMs && opts.tickMs >= 1) this.tickMs = opts.tickMs;
    if (dev && opts.waitMs && opts.waitMs >= 1) this.waitMs = opts.waitMs;
    if (opts.quick) this.maxClients = this.arena.lobby().max;
    void this.setPrivate(!opts.quick);

    this.onMessage('cfg', (c, m: Partial<RoomCfg>) => {
      if (this.arena.setCfg(c.sessionId, m ?? {})) this.sendLobby();
    });
    this.onMessage('me', (c, m: MeMsg) => {
      if (this.arena.setMe(c.sessionId, m)) this.sendLobby();
    });
    this.onMessage('start', (c, m: { aspect?: number }) => this.startMatch(c.sessionId, Number(m?.aspect)));
    this.onMessage('in', (c, m: InputMsg) => this.arena.input(c.sessionId, m?.q, m?.i));
    this.onMessage('resync', (c) => this.sendSnap(c));
    // clientul și-a înregistrat handler-ele: îi retrimitem lobby-ul (și meciul, dacă a pornit)
    this.onMessage('hello', (c) => {
      c.send('lobby', this.arena.lobby());
      this.sendSnap(c);
    });
    this.onMessage('ping', (c, t: number) => c.send('pong', t));
  }

  override onJoin(client: Client, opts: JoinOpts = {}): void {
    const err = this.arena.join(client.sessionId, opts);
    if (err) throw new ServerError(4001, err);
    if (this.arena.seats.length === 1 && Number.isFinite(opts.aspect)) this.aspect = Number(opts.aspect);
    this.sendLobby();
    this.quickCheck();
  }

  /** Joc rapid: pornește când camera e plină, altfel după numărătoare. */
  private quickCheck(): void {
    const a = this.arena;
    if (!a.quick || a.phase !== 'lobby') return;
    if (!a.seats.length) {
      this.stopCountdown();
      return;
    }
    if (a.full) {
      this.stopCountdown();
      this.launch(() => a.startAuto(this.seed(), this.aspect));
      return;
    }
    if (this.countdown) return;
    const end = Date.now() + this.waitMs;
    const update = () => {
      const left = Math.max(0, end - Date.now());
      a.startIn = Math.ceil(left / 1000);
      if (left <= 0) {
        this.stopCountdown();
        this.launch(() => a.startAuto(this.seed(), this.aspect));
      } else this.sendLobby();
    };
    this.countdown = this.clock.setInterval(update, Math.min(1000, this.waitMs));
    update();
  }

  private stopCountdown(): void {
    this.countdown?.clear();
    this.countdown = null;
    this.arena.startIn = null;
  }

  private seed(): number {
    return Math.floor(Math.random() * 0x7fffffff);
  }

  override async onDrop(client: Client): Promise<void> {
    this.arena.drop(client.sessionId);
    this.sendLobby();
    await this.allowReconnection(client, RECONNECT_S);
  }

  override onReconnect(client: Client): void {
    this.arena.reconnect(client.sessionId);
    this.sendLobby();
    this.sendSnap(client);
  }

  override onLeave(client: Client): void {
    this.arena.leave(client.sessionId);
    this.sendLobby();
    if (this.arena.phase === 'lobby') void this.unlock();
    this.quickCheck();
  }

  override onDispose(): void {
    codes.delete(this.roomId);
  }

  private sendLobby(): void {
    this.broadcast('lobby', this.arena.lobby());
  }

  private sendSnap(client: Client): void {
    const snap = this.arena.snapFor(client.sessionId);
    if (snap) client.send('snap', snap);
  }

  private startMatch(sid: string, aspect: number): void {
    this.launch(() => this.arena.start(sid, this.seed(), aspect));
  }

  private launch(start: () => boolean): void {
    if (!start()) return;
    void this.lock();
    this.sendLobby();
    for (const c of this.clients) this.sendSnap(c);
    this.acc = 0;
    this.setSimulationInterval((dt) => this.update(dt), this.tickMs);
  }

  private update(dt: number): void {
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.tickMs && n++ < 5) {
      this.acc -= this.tickMs;
      const f = this.arena.tick();
      if (f) this.broadcast('f', f);
      const end = this.arena.finish();
      if (end) {
        this.broadcast('end', end);
        this.setSimulationInterval(undefined);
        void this.unlock();
        this.sendLobby();
        this.quickCheck();
        return;
      }
    }
    if (this.acc > this.tickMs * 5) this.acc = 0; // server blocat: nu recupera la nesfârșit
  }
}
