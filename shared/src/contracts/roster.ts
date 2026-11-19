import { z } from 'zod';

/** Roster CSV import (FR-CFG-1/2/3, docs/ROSTER_IMPORT.md). */

export const RosterUploadBody = z.object({
  csv: z.string().min(1, 'The file is empty.').max(1_000_000, 'The file is larger than 1 MB.'),
});
export type RosterUploadBody = z.infer<typeof RosterUploadBody>;

export const RosterIssue = z.object({
  /** 1-based line number in the file (header = 1); 0 for whole-file problems. */
  row: z.number().int(),
  column: z.string(),
  message: z.string(),
});
export type RosterIssue = z.infer<typeof RosterIssue>;

export const RosterRowStatus = z.enum(['new', 'updated', 'unchanged']);
export type RosterRowStatus = z.infer<typeof RosterRowStatus>;

export const RosterPreviewResponse = z.object({
  summary: z.object({
    new: z.number().int(),
    updated: z.number().int(),
    unchanged: z.number().int(),
    errors: z.number().int(),
  }),
  rows: z.array(
    z.object({
      row: z.number().int(),
      name: z.string(),
      email: z.string(),
      status: RosterRowStatus,
    }),
  ),
  errors: z.array(RosterIssue),
  /** Active people not in this file. They are kept, never auto-deleted. */
  missing: z.array(z.object({ id: z.uuid(), name: z.string(), email: z.string() })),
});
export type RosterPreviewResponse = z.infer<typeof RosterPreviewResponse>;

export const RosterCommitResponse = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  unchanged: z.number().int(),
});
export type RosterCommitResponse = z.infer<typeof RosterCommitResponse>;

/** Accepted spellings of ranks in the CSV (case-insensitive). */
export const RANK_CSV_VALUES = {
  cc: 'cc',
  deputy: 'deputy',
  'shadow ic': 'shadow_ic',
  ic: 'ic',
  volunteer: 'volunteer',
} as const;

export const dayColumnName = (date: string) => `day_${date}`;
