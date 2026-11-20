import { z } from 'zod';

/** Duty emails that failed for good after the retries (FR-NOTIF-3), one row per person. */
export const FailedEmail = z.object({
  personId: z.uuid(),
  name: z.string(),
  email: z.string(),
  changes: z.number().int(),
  lastError: z.string().nullable(),
  lastTriedAt: z.string().nullable(),
});
export type FailedEmail = z.infer<typeof FailedEmail>;

export const FailedEmailsResponse = z.object({
  failed: z.array(FailedEmail),
  /** Emails still waiting to go out (batching window or a retry pending). */
  queued: z.number().int(),
});
export type FailedEmailsResponse = z.infer<typeof FailedEmailsResponse>;

export const RetryEmailBody = z.object({ personId: z.uuid() });
export type RetryEmailBody = z.infer<typeof RetryEmailBody>;

export const RetryEmailResponse = z.object({ requeued: z.number().int() });
export type RetryEmailResponse = z.infer<typeof RetryEmailResponse>;
