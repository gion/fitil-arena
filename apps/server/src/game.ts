import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { setDatabase } from './database.ts';
import type { Db } from './db/index.ts';
import { InfiniteRoom } from './infinite.ts';
import { ArenaRoom } from './room.ts';

/**
 * Serverul de joc (Colyseus): camera privată `arena`, jocul rapid public `quick` (câte una pe mod)
 * și lumea comună `infinite` (o instanță nouă când cea curentă e plină).
 */
export function buildGameServer(db: Db | null = null): Server {
  setDatabase(db);
  const server = new Server({ transport: new WebSocketTransport(), gracefullyShutdown: false });
  server.define('arena', ArenaRoom);
  server.define('quick', ArenaRoom, { quick: true }).filterBy(['mode', 'bracket']);
  server.define('infinite', InfiniteRoom);
  return server;
}
