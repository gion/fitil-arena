import { Room, ServerError } from '@colyseus/core';
import type { Client } from '@colyseus/core';
import { TICK_MS } from '@fitil/sim';
import { ArenaHost, CODE_LETTERS, RECONNECT_S } from '@fitil/net';
import type { InputMsg, RoomCfg } from '@fitil/net';

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

  override onCreate(opts: CreateOpts = {}): void {
    const code = newCode();
    codes.add(code);
    this.roomId = code;
    this.arena = new ArenaHost(code);
    if (process.env.NODE_ENV !== 'production' && opts.tickMs && opts.tickMs >= 1) this.tickMs = opts.tickMs;
    void this.setPrivate(true);

    this.onMessage('cfg', (c, m: Partial<RoomCfg>) => {
      if (this.arena.setCfg(c.sessionId, m ?? {})) this.sendLobby();
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

  override onJoin(client: Client, opts: { name?: string } = {}): void {
    const err = this.arena.join(client.sessionId, opts.name);
    if (err) throw new ServerError(4001, err);
    this.sendLobby();
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
    const seed = Math.floor(Math.random() * 0x7fffffff);
    if (!this.arena.start(sid, seed, aspect)) return;
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
        return;
      }
    }
    if (this.acc > this.tickMs * 5) this.acc = 0; // server blocat: nu recupera la nesfârșit
  }
}
