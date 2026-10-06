import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.ts';

export { schema };
export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface Database {
  db: Db;
  close(): Promise<void>;
}

/** Conexiunea la Postgres (`DATABASE_URL`). */
export function connect(url: string): Database {
  const sql = postgres(url, { max: 10, onnotice: () => {} });
  return { db: drizzle(sql, { schema }), close: () => sql.end({ timeout: 5 }) };
}

/** Aplică migrațiile din `drizzle/` (idempotent). */
export async function runMigrations(d: Database): Promise<void> {
  // din sursă (src/db) sau din build (dist): primul director care există
  const dir = ['../../drizzle', '../drizzle']
    .map((p) => fileURLToPath(new URL(p, import.meta.url)))
    .find((p) => existsSync(p));
  if (!dir) throw new Error('lipsește directorul de migrații (drizzle/)');
  await migrate(d.db, { migrationsFolder: dir });
}
