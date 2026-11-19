import type { Course, FootfallVariant, Rank, RegCategory, StationKind } from './enums.js';

/** Human-readable labels used by the UI, CSV import and reports. */

export const RANK_LABELS: Record<Rank, string> = {
  cc: 'CC',
  deputy: 'Deputy',
  shadow_ic: 'Shadow IC',
  ic: 'IC',
  volunteer: 'Volunteer',
};

export const REG_CATEGORY_LABELS: Record<RegCategory, string> = {
  sec1: 'Sec 1',
  sec2: 'Sec 2',
  sec3: 'Sec 3',
  sec4: 'Sec 4',
  sec5: 'Sec 5',
  graduated: 'Graduated, awaiting results',
  parent: 'Parent / Guardian',
  other: 'Other',
};

export const STATION_KIND_LABELS: Record<StationKind, string> = {
  staffed: 'Staffed only',
  registration: 'Registration',
  counting: 'Counting point',
  counselling: 'Counselling (guided / walk-in)',
};

export const COURSE_LABELS: Record<Course, string> = {
  DAAA: 'DAAA',
  DCDF: 'DCDF',
  DCS: 'DCS',
  DCITP: 'DCITP',
  Other: 'Other',
};

export const FOOTFALL_VARIANT_LABELS: Record<FootfallVariant, string> = {
  entry: 'Entered',
  guided: 'Guided group',
  walk_in: 'Walk-in (counselling only)',
};
