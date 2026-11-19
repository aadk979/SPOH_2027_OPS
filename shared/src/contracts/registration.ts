import { z } from 'zod';
import { MAX_RECORDS_PER_REQUEST } from '../counting.js';
import { REG_CATEGORIES } from '../enums.js';

/*
 * /api/registrations: anonymous visitor categories at a sign-up point (FR-REG-*).
 * RULE 1: these shapes never carry footfall numbers. RULE 2: no visitor data, ever.
 */

/** Random per-browser ID (not personal): lets the screen show "this device today". */
export const DeviceIdSchema = z.string().trim().min(8).max(64);

export const RegistrationRecordInput = z.object({
  /** Generated on the device for each visitor; a retried request is stored once (FR-REG-5). */
  clientId: z.uuid(),
  category: z.enum(REG_CATEGORIES),
});

export const CreateRegistrationsBody = z.object({
  stationId: z.uuid(),
  deviceId: DeviceIdSchema,
  /** Set for a family/group: every record in the request shares it (FR-REG-2). */
  groupId: z.uuid().nullable().default(null),
  records: z.array(RegistrationRecordInput).min(1).max(MAX_RECORDS_PER_REQUEST),
});
export type CreateRegistrationsBody = z.input<typeof CreateRegistrationsBody>;

export const CreateCountsResponse = z.object({
  /** Records newly stored; retries of already-stored client IDs are not counted again. */
  saved: z.number().int(),
});
export type CreateCountsResponse = z.infer<typeof CreateCountsResponse>;

export const SummaryQuery = z.object({
  stationId: z.uuid(),
  deviceId: DeviceIdSchema.optional(),
});
export type SummaryQuery = z.infer<typeof SummaryQuery>;

export const RegistrationSummary = z.object({
  stationId: z.uuid(),
  /** The Singapore calendar date summarised (YYYY-MM-DD). */
  date: z.string(),
  /** Visitors registered at this station today. */
  total: z.number().int(),
  /** Of those, recorded on the requesting device. */
  device: z.number().int(),
  byCategory: z.record(z.enum(REG_CATEGORIES), z.number().int()),
});
export type RegistrationSummary = z.infer<typeof RegistrationSummary>;
