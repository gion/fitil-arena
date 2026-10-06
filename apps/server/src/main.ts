import { buildApp } from './app.ts';
import { connect, runMigrations } from './db/index.ts';
import { buildGameServer } from './game.ts';

const port = Number(process.env.API_PORT ?? 3000);
const gamePort = Number(process.env.PORT ?? 2567);
// fără DATABASE_URL serverul pornește „fără conturi”: doar vizitatori și API-ul de sănătate
const url = process.env.DATABASE_URL;
const database = url ? connect(url) : null;
if (database) {
  await runMigrations(database);
  console.log('Postgres conectat, migrații aplicate');
} else console.log('DATABASE_URL lipsește: fără conturi (doar vizitatori)');
const app = buildApp(database?.db);
await app.listen({ port, host: '0.0.0.0' });
console.log(`API pe http://localhost:${port}`);
await buildGameServer(database?.db ?? null).listen(gamePort);
console.log(`Joc (Colyseus) pe ws://localhost:${gamePort}`);
