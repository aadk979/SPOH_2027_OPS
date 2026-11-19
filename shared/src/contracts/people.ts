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

/** The fields with no defaults, so a patch only contains what the caller sent. */
const PersonFields = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: EmailSchema,
  phone: PhoneSchema.nullable(),
  course: z.enum(COURSES).nullable(),
  rank: z.enum(RANKS),
  team: z.string().trim().min(1).nullable(),
  portfolio: z.string().trim().min(1).nullable(),
  availableDayIds: z.array(z.uuid()),
});

export const PersonInput = PersonFields.extend({
  phone: PersonFields.shape.phone.default(null),
  course: PersonFields.shape.course.default(null),
  team: PersonFields.shape.team.default(null),
  portfolio: PersonFields.shape.portfolio.default(null),
  availableDayIds: PersonFields.shape.availableDayIds.default([]),
});
export type PersonInput = z.infer<typeof PersonInput>;

/**
 * Built from the default-free fields: Zod's .partial() still applies defaults, which would
 * silently blank fields the caller never sent (e.g. Deactivate wiping a phone number).
 */
export const PersonPatch = PersonFields.partial().extend({ active: z.boolean().optional() });
export type PersonPatch = z.infer<typeof PersonPatch>;

export const PeopleListResponse = z.object({ people: z.array(PersonDto) });
export type PeopleListResponse = z.infer<typeof PeopleListResponse>;
