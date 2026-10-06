import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import type { Profile } from '@fitil/content';

/** Cont anonim pe dispozitiv: tokenul nu se păstrează, doar hash-ul lui (SHA-256). */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  name: text('name').notNull().default('Player'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Profilul (monede, personaje, XP, cosmetice…): documentul `Profile` din `@fitil/content`. */
export const profiles = pgTable('profiles', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Profile>().notNull(),
  /** Profilul local (offline) a fost deja preluat o dată: nu se mai acceptă altul. */
  imported: boolean('imported').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trophies = pgTable(
  'trophies',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    ch: text('ch').notNull(),
    trophies: integer('trophies').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.ch] })],
);

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  mode: text('mode').notNull(),
  seed: integer('seed').notNull(),
  ticks: integer('ticks').notNull(),
  playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matchPlayers = pgTable(
  'match_players',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    ch: text('ch'),
    place: integer('place').notNull(),
    won: boolean('won').notNull(),
    kills: integer('kills').notNull(),
    boxes: integer('boxes').notNull(),
    trophyDelta: integer('trophy_delta').notNull(),
    coins: integer('coins').notNull(),
    xp: integer('xp').notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.accountId] }), index('match_players_account').on(t.accountId)],
);

/** Provocarea zilei: cel mai bun rezultat (în tick-uri, mai puține = mai bine) per cont și zi. */
export const dailyScores = pgTable(
  'daily_scores',
  {
    day: text('day').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    ticks: integer('ticks').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.accountId] }), index('daily_day_ticks').on(t.day, t.ticks)],
);
