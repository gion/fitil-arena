import { Room, ServerError } from '@colyseus/core';
import type { Client } from '@colyseus/core';
import { TICK_MS } from '@fitil/sim';
import { seasonalTheme } from '@fitil/content';
import { BOARD_EVERY, INF_MAX, InfHost } from '@fitil/net';
import type { InfFrame, InfWelcome, InputMsg, MeMsg } from '@fitil/net';
import { authenticate, getProfile } from './accounts.ts';
import { getDatabase } from './database.ts';
import { ownedMe } from './room.ts';

/** Cât poate lipsi un client (rețea pierdută) înainte să iasă din lume. */
const RECONNECT_S = 10;

/** Statisticile unei instanțe (pentru testul de încărcare și monitorizare). */
export interface InfStats {
  ticks: number;
  /** Durata tick-ului (simulare + mesaje), ms. */
  tickMs: number[];
}

/** Instanțele Infinit active (roomId → statistici). */
export const infStats = new Map<string, InfStats>();

interface CreateOpts {
  /** Doar în dezvoltare/teste: seed fix și o instanță mai mică (ca să se vadă shard-urile). */
  seed?: number;
  max?: number;
}

interface JoinOpts extends MeMsg {
  token?: string;
}

/**
 * Modul Infinit online: o lume comună pentru până la `INF_MAX` oameni, care intră și ies oricând.
 * Când instanța e plină, `joinOrCreate` deschide alta (shard). Logica e în `InfHost` (`@fitil/net`).
 */
export class InfiniteRoom extends Room {
  override maxClients = INF_MAX;
  private host!: InfHost;
  private stats!: InfStats;
  private acc = 0;

  override onCreate(opts: CreateOpts = {}): void {
    const dev = process.env.NODE_ENV !== 'production';
    const seed = dev && Number.isInteger(opts.seed) ? opts.seed! : Math.floor(Math.random() * 0x7fffffff);
    if (dev && Number.isInteger(opts.max) && opts.max! >= 1) this.maxClients = Math.min(INF_MAX, opts.max!);
    const theme = seasonalTheme(new Date())?.id ?? 'clasic';
    this.host = new InfHost(seed, theme, this.roomId);
    this.stats = { ticks: 0, tickMs: [] };
    infStats.set(this.roomId, this.stats);
    this.onMessage('in', (c, m: InputMsg) => this.host.input(c.sessionId, m?.q, m?.i));
    this.onMessage('ping', (c, t: number) => c.send('pong', t));
    // clientul și-a înregistrat handler-ele: îi (re)trimitem bun venitul
    this.onMessage('hello', (c) => this.welcome(c));
    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);
  }

  override async onAuth(_client: Client, opts: JoinOpts = {}): Promise<MeMsg> {
    const db = getDatabase();
    if (!opts.token || !db) return opts;
    const accountId = await authenticate(db, opts.token);
    if (!accountId) throw new ServerError(4003, 'Invalid session. Please restart the game.');
    return ownedMe(await getProfile(db, accountId), opts);
  }

  private welcomes = new Map<string, InfWelcome>();

  override onJoin(client: Client, _opts: JoinOpts = {}, me: MeMsg = {}): void {
    const w = this.host.join(client.sessionId, me);
    if (!w) throw new ServerError(4005, 'This world is full.');
    this.welcomes.set(client.sessionId, w);
    void this.setMetadata({ n: this.host.size });
  }

  /** Bun venit (la intrare și după reconectare): clientul își reface oglinda, serverul îi retrimite tot. */
  private welcome(c: Client): void {
    const w = this.welcomes.get(c.sessionId);
    if (!w) return;
    this.host.resync(c.sessionId);
    c.send('welcome', { ...w, tick: this.host.s.tick, roster: this.host.rosterList() });
  }

  override async onDrop(client: Client): Promise<void> {
    await this.allowReconnection(client, RECONNECT_S);
  }

  override onReconnect(client: Client): void {
    this.welcome(client);
  }

  override onLeave(client: Client): void {
    this.host.leave(client.sessionId);
    this.welcomes.delete(client.sessionId);
    void this.setMetadata({ n: this.host.size });
  }

  override onDispose(): void {
    infStats.delete(this.roomId);
  }

  private update(dt: number): void {
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK_MS && n++ < 5) {
      this.acc -= TICK_MS;
      this.tick();
    }
    if (this.acc > TICK_MS * 5) this.acc = 0; // server blocat: nu recupera la nesfârșit
  }

  private tick(): void {
    const t0 = performance.now();
    const frames = this.host.tick();
    const roster = this.host.takeRoster();
    if (roster) this.broadcast('roster', roster);
    const boards = this.host.s.tick % BOARD_EVERY === 0 ? this.host.boards() : null;
    for (const c of this.clients) {
      const f: InfFrame | undefined = frames.get(c.sessionId);
      if (!f) continue;
      c.send('f', f);
      const b = boards?.get(c.sessionId);
      if (b) c.send('board', b);
    }
    const st = this.stats;
    st.ticks++;
    st.tickMs.push(performance.now() - t0);
    if (st.tickMs.length > 2000) st.tickMs.splice(0, st.tickMs.length - 2000);
  }
}
