import type { FootfallVariant, StationKind } from './enums.js';

/**
 * Rules shared by registration and footfall capture. The two kinds of count still live in
 * separate tables, endpoints and screens (Rule 1); only these limits are common.
 */

/** A tap can be undone by the person who recorded it for this long (FR-REG-3, FR-FOOT-5). */
export const UNDO_WINDOW_MS = 10_000;

/** Largest "+n" group a single footfall record may carry (matches the DB check). */
export const FOOTFALL_MAX_COUNT = 100;

/** Most records accepted in one request (a family, or a burst of retried taps). */
export const MAX_RECORDS_PER_REQUEST = 50;

/** Station kinds that have a counting screen. Staffed-only stations are not counted. */
export const COUNTABLE_STATION_KINDS = [
  'registration',
  'counting',
  'counselling',
] as const satisfies readonly StationKind[];
export type CountableStationKind = (typeof COUNTABLE_STATION_KINDS)[number];

export function isCountableKind(kind: StationKind): kind is CountableStationKind {
  return (COUNTABLE_STATION_KINDS as readonly StationKind[]).includes(kind);
}

/** Which footfall variants each station kind accepts (FR-FOOT-1/3). */
export const FOOTFALL_VARIANTS_FOR_KIND: Partial<Record<StationKind, readonly FootfallVariant[]>> =
  {
    counting: ['entry'],
    counselling: ['guided', 'walk_in'],
  };
