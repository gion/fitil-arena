import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { setDatabase } from './database.ts';
import type { Db } from './db/index.ts';
import { ArenaRoom } from './room.ts';

/** Serverul de joc (Colyseus): camera privată `arena` și jocul rapid public `quick` (câte una pe mod). */
export function buildGameServer(db: Db | null = null): Server {
  setDatabase(db);
  const server = new Server({ transport: new WebSocketTransport(), gracefullyShutdown: false });
  server.define('arena', ArenaRoom);
  server.define('quick', ArenaRoom, { quick: true }).filterBy(['mode', 'bracket']);
  return server;
}
