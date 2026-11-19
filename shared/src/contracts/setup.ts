import { z } from 'zod';
import { TIME_PATTERN } from '../days.js';
import { STATION_KINDS } from '../enums.js';
import { StationDto } from './stations.js';

/** Admin setup: event days, stations and thresholds (FR-CFG-5/5a/5b/6, FR-DASH-3). */

const TimeSchema = z.string().regex(TIME_PATTERN, 'Use 24-hour time, e.g. 09:00.');

const DayFields = z.object({
  date: z.iso.date('Pick a date.'),
  label: z.string().trim().max(80),
  reportTime: TimeSchema.nullable(),
  dismissTime: TimeSchema.nullable(),
});

export const DayInput = DayFields.extend({
  label: DayFields.shape.label.default(''),
  reportTime: DayFields.shape.reportTime.default(null),
  dismissTime: DayFields.shape.dismissTime.default(null),
});
export type DayInput = z.infer<typeof DayInput>;

/** Default-free, so only the fields sent are changed (see PersonPatch). */
export const DayPatch = DayFields.partial();
export type DayPatch = z.infer<typeof DayPatch>;

/** What removing a day would affect (FR-CFG-5a). Counts are listed but always kept. */
export const DayImpact = z.object({
  assignments: z.number().int(),
  breaks: z.number().int(),
  dutyChanges: z.number().int(),
  availablePeople: z.number().int(),
  registrationsKept: z.number().int(),
  footfallKept: z.number().int(),
});
export type DayImpact = z.infer<typeof DayImpact>;

/** A station with the Admin-only fields. */
export const StationAdminDto = StationDto.extend({
  capacity: z.number().int().nullable(),
  active: z.boolean(),
});
export type StationAdminDto = z.infer<typeof StationAdminDto>;

export const StationsAdminResponse = z.object({ stations: z.array(StationAdminDto) });
export type StationsAdminResponse = z.infer<typeof StationsAdminResponse>;

const StationFields = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  location: z.string().trim().max(80),
  room: z.string().trim().max(40),
  kind: z.enum(STATION_KINDS),
  team: z.string().trim().min(1).nullable(),
  capacity: z.number().int().min(1).max(5000).nullable(),
  sortOrder: z.number().int().min(0).max(999),
});

export const StationInput = StationFields.extend({
  location: StationFields.shape.location.default(''),
  room: StationFields.shape.room.default(''),
  team: StationFields.shape.team.default(null),
  capacity: StationFields.shape.capacity.default(null),
  sortOrder: StationFields.shape.sortOrder.default(0),
});
export type StationInput = z.infer<typeof StationInput>;

/** Default-free, so only the fields sent are changed (see PersonPatch). */
export const StationPatch = StationFields.partial().extend({ active: z.boolean().optional() });
export type StationPatch = z.infer<typeof StationPatch>;

/** Busy/quiet and low-stock thresholds. Quiet must stay below busy. */
export const Thresholds = z
  .object({
    busyWindowMin: z.number().int().min(5).max(180),
    busyPct: z.number().int().min(1).max(100),
    quietPct: z.number().int().min(0).max(99),
    lowStockPct: z.number().int().min(1).max(90),
  })
  .refine((t) => t.quietPct < t.busyPct, {
    message: 'Quiet must be lower than busy.',
    path: ['quietPct'],
  });
export type Thresholds = z.infer<typeof Thresholds>;
