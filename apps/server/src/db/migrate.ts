import { connect, runMigrations } from './index.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL lipsește');
const d = connect(url);
await runMigrations(d);
await d.close();
console.log('migrații aplicate');
