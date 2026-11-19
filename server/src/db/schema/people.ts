import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { courseEnum, rankEnum } from './enums.js';

/** Committee members: CC, Deputies, Shadow ICs, ICs and volunteers (data_model.md §1). */
export const person = pgTable(
  'person',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Stored lower-cased; unique login and import key. */
    email: text('email').notNull(),
    /** Contact details are only visible up the chain of command (NFR-S-2). */
    phone: text('phone'),
    course: courseEnum('course'),
    rank: rankEnum('rank').notNull(),
    team: text('team'),
    /** Deputy: portfolio led. Shadow IC: portfolio shadowed, or 'CC'. */
    portfolio: text('portfolio'),
    /** Event days this person can attend (FR-DUTY-1). */
    availableDayIds: uuid('available_day_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('person_email_unique').on(t.email)],
);
