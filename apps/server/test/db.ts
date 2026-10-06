import { sql } from 'drizzle-orm';
import { connect, runMigrations } from '../src/db/index.ts';
import type { Database } from '../src/db/index.ts';

/** Postgres de test (docker compose, `pnpm db:up`). Fără `TEST_DATABASE_URL`, testele cu bază de date se sar. */
export const TEST_DB_URL = process.env.TEST_DATABASE_URL;

export async function openTestDb(): Promise<Database> {
  const d = connect(TEST_DB_URL!);
  await runMigrations(d);
  await d.db.execute(sql`truncate accounts, matches restart identity cascade`);
  return d;
}
