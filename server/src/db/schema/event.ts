import { boolean, date, integer, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
import { stationKindEnum } from './enums.js';

/** A configurable event day with one report/dismiss time for all volunteers (FR-CFG-5). */
export const eventDay = pgTable('event_day', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date', { mode: 'string' }).notNull().unique(),
  label: text('label').notNull().default(''),
  reportTime: time('report_time'),
  dismissTime: time('dismiss_time'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A staffed and/or counted point; `location` groups stations in the same room (FR-CFG-6). */
export const station = pgTable('station', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  location: text('location').notNull().default(''),
  room: text('room').notNull().default(''),
  kind: stationKindEnum('kind').notNull(),
  /** Owning team: its IC may manage gift points here. */
  team: text('team'),
  /** Used for busy/quiet flags; null = no flag (FR-DASH-3). */
  capacity: integer('capacity'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
