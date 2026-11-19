import { z } from 'zod';
import { COURSES, RANKS } from '../enums.js';
import { TIERS } from '../permissions.js';

/** Request/response shapes for /api/auth/* and /api/me, shared by client and server. */

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }));

export const RequestCodeBody = z.object({ email: EmailSchema });
export type RequestCodeBody = z.infer<typeof RequestCodeBody>;

export const VerifyCodeBody = z.object({
  email: EmailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'The code is 6 digits.'),
});
export type VerifyCodeBody = z.infer<typeof VerifyCodeBody>;

export const CurrentUser = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  rank: z.enum(RANKS),
  tier: z.enum(TIERS),
  team: z.string().nullable(),
  portfolio: z.string().nullable(),
  course: z.enum(COURSES).nullable(),
  /** True for the Welfare IC (may manage breaks) and for admins. */
  canManageBreaks: z.boolean(),
});
export type CurrentUser = z.infer<typeof CurrentUser>;

export const VerifyCodeResponse = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: CurrentUser,
});
export type VerifyCodeResponse = z.infer<typeof VerifyCodeResponse>;

export const MessageResponse = z.object({ message: z.string() });
export type MessageResponse = z.infer<typeof MessageResponse>;

export const IssuedCodeResponse = z.object({
  code: z.string(),
  expiresAt: z.string(),
  personName: z.string(),
});
export type IssuedCodeResponse = z.infer<typeof IssuedCodeResponse>;
