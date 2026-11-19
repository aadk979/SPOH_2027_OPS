import { z } from 'zod';
import { COURSES, RANKS } from '../enums.js';
import { EmailSchema } from './auth.js';

/** Singapore phone: 8 digits starting 3/6/8/9, optional +65 / spaces, stored as 8 digits. */
export const PhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^\+?65(?=\d{8}$)/, ''))
  .pipe(z.string().regex(/^[3689]\d{7}$/, 'Phone must be an 8-digit Singapore number.'));

export const PersonDto = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  course: z.enum(COURSES).nullable(),
  rank: z.enum(RANKS),
  team: z.string().nullable(),
  portfolio: z.string().nullable(),
  availableDayIds: z.array(z.uuid()),
  active: z.boolean(),
});
export type PersonDto = z.infer<typeof PersonDto>;

export const PersonInput = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: EmailSchema,
  phone: PhoneSchema.nullable().default(null),
  course: z.enum(COURSES).nullable().default(null),
  rank: z.enum(RANKS),
  team: z.string().trim().min(1).nullable().default(null),
  portfolio: z.string().trim().min(1).nullable().default(null),
  availableDayIds: z.array(z.uuid()).default([]),
});
export type PersonInput = z.infer<typeof PersonInput>;

export const PersonPatch = PersonInput.partial().extend({ active: z.boolean().optional() });
export type PersonPatch = z.infer<typeof PersonPatch>;

export const PeopleListResponse = z.object({ people: z.array(PersonDto) });
export type PeopleListResponse = z.infer<typeof PeopleListResponse>;
