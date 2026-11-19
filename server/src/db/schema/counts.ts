import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { courseEnum, footfallVariantEnum, regCategoryEnum } from './enums.js';
import { station } from './event.js';
import { person } from './people.js';

/*
 * RULE 1: registration and footfall are separate tables and are never summed together.
 * RULE 2: neither table has any column that could identify a visitor.
 */

/** One anonymous visitor registered at a sign-up point (FR-REG-*). */
export const registration = pgTable(
  'registration',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** Generated on the device per tap; makes retries idempotent (architecture D3). */
    clientId: uuid('client_id').notNull().unique(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'restrict' }),
    category: regCategoryEnum('category').notNull(),
    groupId: uuid('group_id'),
    recordedBy: uuid('recorded_by').references(() => person.id, { onDelete: 'set null' }),
    deviceId: text('device_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => person.id, { onDelete: 'set null' }),
  },
  (t) => [index('registration_station_time_idx').on(t.stationId, t.recordedAt)],
);

/** People entering a counting point; `count` > 1 for "+n" taps (FR-FOOT-*). */
export const footfall = pgTable(
  'footfall',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clientId: uuid('client_id').notNull().unique(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'restrict' }),
    variant: footfallVariantEnum('variant').notNull().default('entry'),
    count: integer('count').notNull().default(1),
    /** Optional counselling course tag (FR-FOOT-4). */
    course: courseEnum('course'),
    recordedBy: uuid('recorded_by').references(() => person.id, { onDelete: 'set null' }),
    deviceId: text('device_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => person.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('footfall_station_time_idx').on(t.stationId, t.recordedAt),
    check('footfall_count_positive', sql`${t.count} between 1 and 100`),
  ],
);
