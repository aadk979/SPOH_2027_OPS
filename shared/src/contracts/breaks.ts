import { z } from 'zod';
import { TIME_PATTERN } from '../days.js';

/** Break slots (FR-BRK-*). A "slot" is everyone on the same day with the same start, end and label. */

const time = z.string().regex(TIME_PATTERN, 'Use 24-hour time.');
const label = z.string().trim().max(40, 'Keep the label under 40 characters.');
const endsAfterStart = (b: { start: string; end: string }) => b.end > b.start;
const endMessage = { message: 'The break must end after it starts.', path: ['end'] };

export const BreaksQuery = z.object({ dayId: z.uuid() });
export type BreaksQuery = z.infer<typeof BreaksQuery>;

export const BreakMember = z.object({
  breakId: z.uuid(),
  personId: z.uuid(),
  name: z.string(),
  team: z.string().nullable(),
  /** Where they are posted when the break starts. */
  stationName: z.string().nullable(),
});
export type BreakMember = z.infer<typeof BreakMember>;

export const BreakSlot = z.object({
  start: time,
  end: time,
  label: z.string(),
  people: z.array(BreakMember),
});
export type BreakSlot = z.infer<typeof BreakSlot>;

export const BreaksResponse = z.object({ slots: z.array(BreakSlot) });
export type BreaksResponse = z.infer<typeof BreaksResponse>;

/** Add people to a break: picked one by one, by team, or by station (FR-BRK-2). */
export const AddBreakBody = z
  .object({
    dayId: z.uuid(),
    start: time,
    end: time,
    label: label.default(''),
    personIds: z.array(z.uuid()).max(300).default([]),
    teams: z.array(z.string()).max(20).default([]),
    stationIds: z.array(z.uuid()).max(30).default([]),
    /** Go ahead even if a station would be left with nobody (FR-BRK-4). */
    override: z.boolean().default(false),
  })
  .refine(endsAfterStart, endMessage)
  .refine((b) => b.personIds.length + b.teams.length + b.stationIds.length > 0, {
    message: 'Pick people, a team or a station.',
    path: ['personIds'],
  });
export type AddBreakBody = z.infer<typeof AddBreakBody>;
export type AddBreakInput = z.input<typeof AddBreakBody>;

export const AddBreakResponse = z.object({ added: z.number().int(), unchanged: z.number().int() });
export type AddBreakResponse = z.infer<typeof AddBreakResponse>;

/** Identifies a slot. */
export const SlotRef = z.object({
  dayId: z.uuid(),
  start: time,
  end: time,
  label: z.string().default(''),
});
export type SlotRef = z.infer<typeof SlotRef>;

/** Change a whole slot's times or label; everyone in it is told (FR-BRK-3). */
export const EditSlotBody = z.object({
  slot: SlotRef,
  to: z
    .object({ start: time, end: time, label: label.default('') })
    .refine(endsAfterStart, endMessage),
  override: z.boolean().default(false),
});
export type EditSlotBody = z.infer<typeof EditSlotBody>;
export type EditSlotInput = z.input<typeof EditSlotBody>;

export const RemovedResponse = z.object({ removed: z.number().int() });
export type RemovedResponse = z.infer<typeof RemovedResponse>;

/** Details of the 409 COVERAGE_GAP warning. */
export const CoverageGap = z.object({ stationId: z.uuid(), station: z.string(), at: time });
export type CoverageGap = z.infer<typeof CoverageGap>;
