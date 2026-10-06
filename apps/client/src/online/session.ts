import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { NetClient, lagFromQuery, lagLink } from '@fitil/net';
import type { LagOpts, Link, MeMsg, RoomCfg } from '@fitil/net';

/** Adresa serverului de joc: `VITE_SERVER_URL` sau același host ca pagina, portul 2567. */
export function serverUrl(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname || 'localhost'}:2567`;
}

/** Tokenul de reconectare, ca o reîncărcare a paginii (sau a WebView-ului) să revină în cameră. */
const KEY = 'fitil-room';
const store = (v: string | null) => {
  try {
    if (v) sessionStorage.setItem(KEY, v);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* fără stocare: doar reconectarea automată a SDK-ului */
  }
};

export type SessionStatus = 'online' | 'reconnecting' | 'closed';

/**
 * O cameră online: conexiunea Colyseus + `NetClient`. Simulatorul de latență (D-033) se pornește
 * din URL (`?lag=150`), doar în dezvoltare.
 */
export class OnlineSession {
  readonly net: NetClient;
  readonly lag: LagOpts | null;
  status: SessionStatus = 'online';
  onStatus: (s: SessionStatus, reason?: string) => void = () => {};

  private constructor(readonly room: Room) {
    const link: Link = {
      send: (type, msg) => room.send(type, msg),
      on: (type, fn) => room.onMessage(type, fn as (m: unknown) => void),
    };
    this.lag = import.meta.env.DEV ? lagFromQuery(location.search) : null;
    this.net = new NetClient(this.lag ? lagLink(link, this.lag) : link);
    room.reconnection.minUptime = 1000;
    store(room.reconnectionToken);
    room.onDrop(() => this.set('reconnecting'));
    room.onReconnect(() => {
      store(room.reconnectionToken);
      this.set('online');
    });
    room.onLeave((_code, reason) => {
      store(null);
      this.set('closed', reason);
    });
    room.send('hello');
  }

  private set(s: SessionStatus, reason?: string): void {
    this.status = s;
    this.onStatus(s, reason);
  }

  get code(): string {
    return this.room.roomId;
  }

  get isHost(): boolean {
    return this.net.lobby?.host === this.room.sessionId;
  }

  static async create(me: MeMsg): Promise<OnlineSession> {
    return new OnlineSession(await new Client(serverUrl()).create('arena', me));
  }

  static async join(code: string, me: MeMsg): Promise<OnlineSession> {
    return new OnlineSession(await new Client(serverUrl()).joinById(code.toUpperCase(), me));
  }

  /** Personajul sau ținuta s-au schimbat în lobby. */
  setMe(me: MeMsg): void {
    this.room.send('me', me);
  }

  /** După o reîncărcare: revine în camera de dinainte, dacă au trecut mai puțin de 15s. */
  static async resume(): Promise<OnlineSession | null> {
    let token: string | null;
    try {
      token = sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
    if (!token) return null;
    try {
      return new OnlineSession(await new Client(serverUrl()).reconnect(token));
    } catch {
      store(null);
      return null;
    }
  }

  setCfg(c: Partial<RoomCfg>): void {
    this.room.send('cfg', c);
  }

  start(aspect: number): void {
    this.room.send('start', { aspect });
  }

  leave(): void {
    this.status = 'closed';
    store(null);
    void this.room.leave(true).catch(() => {});
  }
}
