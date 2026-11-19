import { z } from 'zod';

export const EventDayDto = z.object({
  id: z.uuid(),
  date: z.string(),
  label: z.string(),
  reportTime: z.string().nullable(),
  dismissTime: z.string().nullable(),
});
export type EventDayDto = z.infer<typeof EventDayDto>;

export const DaysResponse = z.object({ days: z.array(EventDayDto) });
export type DaysResponse = z.infer<typeof DaysResponse>;

/** The editable lists used by forms (teams, portfolios). */
export const ListsResponse = z.object({
  teams: z.array(z.string()),
  portfolios: z.array(z.string()),
});
export type ListsResponse = z.infer<typeof ListsResponse>;
