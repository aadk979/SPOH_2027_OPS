/**
 * Domain enums. These lists are the single source of truth: the database enums
 * (server/src/db/schema) and the UI labels are both derived from them.
 */

export const RANKS = ['cc', 'deputy', 'shadow_ic', 'ic', 'volunteer'] as const;
export type Rank = (typeof RANKS)[number];

export const COURSES = ['DAAA', 'DCDF', 'DCS', 'DCITP', 'Other'] as const;
export type Course = (typeof COURSES)[number];

/** Courses that can be tagged on a counselling session (FR-FOOT-4). */
export const COUNSELLING_COURSES = ['DAAA', 'DCDF', 'DCS'] as const satisfies readonly Course[];

export const STATION_KINDS = ['staffed', 'registration', 'counting', 'counselling'] as const;
export type StationKind = (typeof STATION_KINDS)[number];

export const REG_CATEGORIES = [
  'sec1',
  'sec2',
  'sec3',
  'sec4',
  'sec5',
  'graduated',
  'parent',
  'other',
] as const;
export type RegCategory = (typeof REG_CATEGORIES)[number];

export const FOOTFALL_VARIANTS = ['entry', 'guided', 'walk_in'] as const;
export type FootfallVariant = (typeof FOOTFALL_VARIANTS)[number];

export const GIFT_MOVEMENT_KINDS = [
  'initial',
  'redeem',
  'restock',
  'correct',
  'transfer_in',
  'transfer_out',
] as const;
export type GiftMovementKind = (typeof GIFT_MOVEMENT_KINDS)[number];

export const EMAIL_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const DUTY_CHANGE_KINDS = ['assignment', 'break', 'timing'] as const;
export type DutyChangeKind = (typeof DUTY_CHANGE_KINDS)[number];

export const AUTH_TOKEN_KINDS = ['code', 'session'] as const;
export type AuthTokenKind = (typeof AUTH_TOKEN_KINDS)[number];
