import { buildApp } from './app.ts';
import { buildGameServer } from './game.ts';

const port = Number(process.env.API_PORT ?? 3000);
const gamePort = Number(process.env.GAME_PORT ?? 2567);
const app = buildApp();
await app.listen({ port, host: '0.0.0.0' });
console.log(`API pe http://localhost:${port}`);
await buildGameServer().listen(gamePort);
console.log(`Joc (Colyseus) pe ws://localhost:${gamePort}`);
