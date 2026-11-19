import type { Rank } from './enums.js';

/**
 * Permission tiers (SRS FR-AUTH-6). Ranks collapse into four ordered tiers:
 * volunteer < ic < admin < cc. Shadow ICs have the same powers as Deputies.
 */
export const TIERS = ['volunteer', 'ic', 'admin', 'cc'] as const;
export type Tier = (typeof TIERS)[number];

const RANK_TO_TIER: Record<Rank, Tier> = {
  volunteer: 'volunteer',
  ic: 'ic',
  deputy: 'admin',
  shadow_ic: 'admin',
  cc: 'cc',
};

export function tierOf(rank: Rank): Tier {
  return RANK_TO_TIER[rank];
}

/** True when `actual` is at least as powerful as `required`. */
export function hasTier(actual: Tier, required: Tier): boolean {
  return TIERS.indexOf(actual) >= TIERS.indexOf(required);
}

/** The team whose IC may manage break schedules (FR-BRK-1). */
export const WELFARE_TEAM = 'Welfare';
