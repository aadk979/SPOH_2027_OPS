import { bigserial, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { giftMovementKindEnum } from './enums.js';
import { station } from './event.js';
import { person } from './people.js';

/** A station giving out one kind of gift; can be created on the fly (FR-GIFT-1). */
export const giftPoint = pgTable('gift_point', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id')
    .notNull()
    .references(() => station.id, { onDelete: 'restrict' }),
  giftName: text('gift_name').notNull(),
  createdBy: uuid('created_by').references(() => person.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

/**
 * Append-only stock ledger. Remaining stock = sum(qty). qty is signed:
 * initial/restock/transfer_in > 0, redeem/transfer_out < 0, correct either way.
 */
export const giftMovement = pgTable(
  'gift_movement',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** Set for redeems so retries never double-redeem. */
    clientId: uuid('client_id').unique(),
    giftPointId: uuid('gift_point_id')
      .notNull()
      .references(() => giftPoint.id, { onDelete: 'cascade' }),
    kind: giftMovementKindEnum('kind').notNull(),
    qty: integer('qty').notNull(),
    reason: text('reason'),
    relatedGiftPointId: uuid('related_gift_point_id').references(() => giftPoint.id, {
      onDelete: 'set null',
    }),
    recordedBy: uuid('recorded_by').references(() => person.id, { onDelete: 'set null' }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('gift_movement_point_idx').on(t.giftPointId, t.recordedAt)],
);
