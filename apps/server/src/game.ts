import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ArenaRoom } from './room.ts';

/** Serverul de joc (Colyseus): camera `arena`. */
export function buildGameServer(): Server {
  const server = new Server({ transport: new WebSocketTransport(), gracefullyShutdown: false });
  server.define('arena', ArenaRoom);
  return server;
}
