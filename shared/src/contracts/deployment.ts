import { z } from 'zod';
import { TIME_PATTERN } from '../days.js';
import { DUTY_CHANGE_KINDS, RANKS } from '../enums.js';

/** Deployment: assign / reassign, the board, and unacknowledged changes (FR-DUTY-2/3/4/8). */

/**
 * Assign or move people. `from` is "now" (the start of the day for a day that hasn't
 * started) or an HH:MM time on each chosen day. Earlier posts are kept as history.
 */
export const AssignBody = z.object({
  personIds: z.array(z.uuid()).min(1, 'Pick at least one person.').max(300),
  stationId: z.uuid(),
  dayIds: z.array(z.uuid()).min(1, 'Pick at least one day.').max(14),
  from: z.union([z.literal('now'), z.string().regex(TIME_PATTERN, 'Use 24-hour time.')]),
  /** Assign even where someone isn't available (FR-DUTY-4). */
  override: z.boolean().default(false),
});
export type AssignBody = z.infer<typeof AssignBody>;

export const AssignResponse = z.object({
  /** New posts saved. */
  assigned: z.number().int(),
  /** Already at that station from that time: nothing changed. */
  unchanged: z.number().int(),
});
export type AssignResponse = z.infer<typeof AssignResponse>;

/** Details of the 409 returned when someone isn't available and override is false. */
export const NotAvailableDetails = z.array(
  z.object({ personId: z.uuid(), name: z.string(), dayId: z.uuid(), day: z.string() }),
);
export type NotAvailableDetails = z.infer<typeof NotAvailableDetails>;

/** A later post on the same day, e.g. "from 13:00 → Counselling Room". */
export const PlannedMove = z.object({ from: z.string(), stationId: z.uuid() });
export type PlannedMove = z.infer<typeof PlannedMove>;

export const BoardPerson = z.object({
  id: z.uuid(),
  name: z.string(),
  rank: z.enum(RANKS),
  team: z.string().nullable(),
  available: z.boolean(),
  /** Station now (or at the start of a day that hasn't begun). */
  stationId: z.uuid().nullable(),
  later: z.array(PlannedMove),
  unacked: z.number().int(),
});
export type BoardPerson = z.infer<typeof BoardPerson>;

export const BoardResponse = z.object({
  dayId: z.uuid(),
  people: z.array(BoardPerson),
});
export type BoardResponse = z.infer<typeof BoardResponse>;

export const BoardQuery = z.object({ dayId: z.uuid() });

export const UnackedChange = z.object({
  id: z.uuid(),
  personId: z.uuid(),
  name: z.string(),
  team: z.string().nullable(),
  stationId: z.uuid().nullable(),
  kind: z.enum(DUTY_CHANGE_KINDS),
  summary: z.string(),
  createdAt: z.string(),
});
export type UnackedChange = z.infer<typeof UnackedChange>;

export const UnackedQuery = z.object({
  stationId: z.uuid().optional(),
  team: z.string().optional(),
});

export const UnackedResponse = z.object({ changes: z.array(UnackedChange) });
export type UnackedResponse = z.infer<typeof UnackedResponse>;
