import { z } from 'zod';
import { STATION_KINDS } from '../enums.js';

/** A station as seen by any signed-in user (station picker, counting screens). */
export const StationDto = z.object({
  id: z.uuid(),
  name: z.string(),
  location: z.string(),
  room: z.string(),
  kind: z.enum(STATION_KINDS),
  team: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type StationDto = z.infer<typeof StationDto>;

export const StationsResponse = z.object({ stations: z.array(StationDto) });
export type StationsResponse = z.infer<typeof StationsResponse>;
