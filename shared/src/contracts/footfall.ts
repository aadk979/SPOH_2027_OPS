import { z } from 'zod';
import { FOOTFALL_MAX_COUNT, MAX_RECORDS_PER_REQUEST } from '../counting.js';
import { COUNSELLING_COURSES, FOOTFALL_VARIANTS } from '../enums.js';
import { DeviceIdSchema } from './registration.js';

/*
 * /api/footfall: people entering a counting point (FR-FOOT-*).
 * RULE 1: these shapes never carry registration numbers. RULE 2: no visitor data, ever.
 */

export const FootfallRecordInput = z.object({
  clientId: z.uuid(),
  variant: z.enum(FOOTFALL_VARIANTS),
  /** People in this tap: 1 for "+1", n for "+n". */
  count: z.number().int().min(1).max(FOOTFALL_MAX_COUNT).default(1),
  /** Optional counselling course tag (FR-FOOT-4). Never required. */
  course: z.enum(COUNSELLING_COURSES).nullable().default(null),
});

export const CreateFootfallBody = z.object({
  stationId: z.uuid(),
  deviceId: DeviceIdSchema,
  records: z.array(FootfallRecordInput).min(1).max(MAX_RECORDS_PER_REQUEST),
});
export type CreateFootfallBody = z.input<typeof CreateFootfallBody>;

export const FootfallSummary = z.object({
  stationId: z.uuid(),
  date: z.string(),
  /** People counted entering this station today. */
  total: z.number().int(),
  /** Of those, recorded on the requesting device. */
  device: z.number().int(),
  byVariant: z.record(z.enum(FOOTFALL_VARIANTS), z.number().int()),
});
export type FootfallSummary = z.infer<typeof FootfallSummary>;
