import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { dutyChangeKindEnum, emailStatusEnum } from './enums.js';
import { eventDay, station } from './event.js';
import { person } from './people.js';

/**
 * Where a person is posted on a day. Rows are never updated: a reassignment adds a
 * new row, so the history is kept. Current post = latest row with effective_from <= now.
 */
export const assignment = pgTable(
  'assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    dayId: uuid('day_id')
      .notNull()
      .references(() => eventDay.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'restrict' }),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by').references(() => person.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assignment_day_person_idx').on(t.dayId, t.personId, t.effectiveFrom)],
);

/** A break for one person. UI "slots" group rows with the same day/start/end/label. */
export const breakPeriod = pgTable(
  'break_period',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    dayId: uuid('day_id')
      .notNull()
      .references(() => eventDay.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    label: text('label'),
    createdBy: uuid('created_by').references(() => person.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('break_day_person_idx').on(t.dayId, t.personId),
    check('break_period_ends_after_start', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

/** A change a volunteer must acknowledge; doubles as the email outbox (architecture D4). */
export const dutyChange = pgTable(
  'duty_change',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    dayId: uuid('day_id').references(() => eventDay.id, { onDelete: 'cascade' }),
    kind: dutyChangeKindEnum('kind').notNull(),
    summary: text('summary').notNull(),
    createdBy: uuid('created_by').references(() => person.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    emailStatus: emailStatusEnum('email_status').notNull().default('pending'),
    emailAttempts: integer('email_attempts').notNull().default(0),
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
    /** Back-off: a failed send is not retried before this time (FR-NOTIF-3). */
    emailNextAttemptAt: timestamp('email_next_attempt_at', { withTimezone: true }),
    /** Last provider error, shown to Admins when a send has failed for good. */
    emailError: text('email_error'),
  },
  (t) => [
    index('duty_change_person_idx').on(t.personId, t.acknowledgedAt),
    index('duty_change_email_idx').on(t.emailStatus, t.createdAt),
  ],
);
