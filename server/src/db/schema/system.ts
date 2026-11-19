import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authTokenKindEnum } from './enums.js';
import { person } from './people.js';

/** Login codes and sessions. Only SHA-256 hashes are stored (architecture D1). */
export const authToken = pgTable(
  'auth_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    kind: authTokenKindEnum('kind').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    /** Set when an Admin issued a manual code (FR-AUTH-5). */
    issuedBy: uuid('issued_by').references(() => person.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auth_token_person_idx').on(t.personId, t.kind, t.createdAt)],
);

/** Who did what, for every administrative or destructive action (FR-AUD-1). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id').references(() => person.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    target: text('target'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_at_idx').on(t.at)],
);

/** Post-event survey (FR-RPT-8). person_id is null when answered anonymously. */
export const surveyResponse = pgTable(
  'survey_response',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id').references(() => person.id, { onDelete: 'set null' }),
    helped: smallint('helped').notNull(),
    mostUseful: text('most_useful'),
    mostAnnoying: text('most_annoying'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('survey_one_per_person').on(t.personId),
    check('survey_helped_range', sql`${t.helped} between 1 and 5`),
  ],
);

/** Hosting / email costs for the Trial Evaluation (FR-RPT-7). */
export const costItem = pgTable('cost_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date', { mode: 'string' }).notNull(),
  description: text('description').notNull(),
  amountSgd: numeric('amount_sgd', { precision: 10, scale: 2 }).notNull(),
  createdBy: uuid('created_by').references(() => person.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface SuccessTargets {
  dailyLoginPct: number;
  medianAckMinutes: number;
  appCapturePct: number;
  surveyHelpedPct: number;
  setupMinutes: number;
}

/** Single-row settings table (id is always 1). */
export const appConfig = pgTable(
  'app_config',
  {
    id: integer('id').primaryKey().default(1),
    busyWindowMin: integer('busy_window_min').notNull().default(30),
    busyPct: integer('busy_pct').notNull().default(80),
    quietPct: integer('quiet_pct').notNull().default(20),
    lowStockPct: integer('low_stock_pct').notNull().default(10),
    emailBatchMin: integer('email_batch_min').notNull().default(2),
    surveyOpen: boolean('survey_open').notNull().default(false),
    teams: text('teams')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    portfolios: text('portfolios')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    successTargets: jsonb('success_targets').$type<SuccessTargets>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('app_config_singleton', sql`${t.id} = 1`)],
);
