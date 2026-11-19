import { z } from 'zod';
import { DUTY_CHANGE_KINDS, RANKS } from '../enums.js';
import { EventDayDto } from './config.js';

/** My Duty, Got it, and the IC's team view (FR-DUTY-5/7/10). */

export const DutyStation = z.object({
  id: z.uuid(),
  name: z.string(),
  room: z.string(),
});
export type DutyStation = z.infer<typeof DutyStation>;

export const DutyDay = z.object({
  day: EventDayDto,
  available: z.boolean(),
  /** Station now (or at the start of a day that hasn't begun); null = not assigned. */
  station: DutyStation.nullable(),
  /** Later moves already planned for that day. */
  later: z.array(z.object({ from: z.string(), station: DutyStation })),
  breaks: z.array(z.object({ start: z.string(), end: z.string(), label: z.string().nullable() })),
});
export type DutyDay = z.infer<typeof DutyDay>;

export const PendingChange = z.object({
  id: z.uuid(),
  kind: z.enum(DUTY_CHANGE_KINDS),
  summary: z.string(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
export type PendingChange = z.infer<typeof PendingChange>;

export const MyDutyResponse = z.object({
  team: z.string().nullable(),
  icNames: z.array(z.string()),
  /** The day to open on: today, else the next event day, else the last (C-7). */
  defaultDayId: z.uuid().nullable(),
  todayDayId: z.uuid().nullable(),
  days: z.array(DutyDay),
  pending: z.array(PendingChange),
});
export type MyDutyResponse = z.infer<typeof MyDutyResponse>;

export const AckBody = z.object({ ids: z.array(z.uuid()).min(1).max(100) });
export type AckBody = z.infer<typeof AckBody>;

export const AckResponse = z.object({ acknowledged: z.number().int() });
export type AckResponse = z.infer<typeof AckResponse>;

export const TeamMember = z.object({
  id: z.uuid(),
  name: z.string(),
  rank: z.enum(RANKS),
  email: z.string(),
  phone: z.string().nullable(),
  available: z.boolean(),
  station: DutyStation.nullable(),
  unacked: z.number().int(),
  oldestUnackedAt: z.string().nullable(),
});
export type TeamMember = z.infer<typeof TeamMember>;

export const TeamQuery = z.object({ dayId: z.uuid().optional() });

export const TeamResponse = z.object({
  team: z.string().nullable(),
  day: EventDayDto.nullable(),
  members: z.array(TeamMember),
});
export type TeamResponse = z.infer<typeof TeamResponse>;
