import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { InfView, lagFromQuery, lagLink } from '@fitil/net';
import type { Link, MeMsg } from '@fitil/net';
import { account } from './account.ts';
import { serverUrl } from './session.ts';
import type { SessionStatus } from './session.ts';

/**
 * Lumea Infinit online (D-069): conexiunea la camera `infinite` + `InfView` (oglinda stării din jurul tău).
 * Intri și ieși oricând; o instanță plină trimite automat într-alta.
 */
export class InfiniteSession {
  readonly view: InfView;
  status: SessionStatus = 'online';
  onStatus: (s: SessionStatus, reason?: string) => void = () => {};

  private constructor(readonly room: Room) {
    const link: Link = {
      send: (type, msg) => room.send(type, msg),
      on: (type, fn) => room.onMessage(type, fn as (m: unknown) => void),
    };
    const lag = import.meta.env.DEV ? lagFromQuery(location.search) : null;
    this.view = new InfView(lag ? lagLink(link, lag) : link);
    room.reconnection.minUptime = 1000;
    room.onDrop(() => this.set('reconnecting'));
    room.onReconnect(() => this.set('online'));
    room.onLeave((_code, reason) => this.set('closed', reason));
    room.onMessage('pong', () => {});
    room.send('hello');
  }

  private set(s: SessionStatus, reason?: string): void {
    this.status = s;
    this.onStatus(s, reason);
  }

  static async join(me: MeMsg): Promise<InfiniteSession> {
    return new InfiniteSession(
      await new Client(serverUrl()).joinOrCreate('infinite', { ...me, token: account.token }),
    );
  }

  leave(): void {
    this.status = 'closed';
    void this.room.leave(true).catch(() => {});
  }
}
