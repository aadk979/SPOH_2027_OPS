import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '@spoh/shared';
import { homePathFor, navFor, phoneNavFor } from './nav';

const user = (over: Partial<CurrentUser>): CurrentUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Test',
  email: 't@x.sg',
  rank: 'volunteer',
  tier: 'volunteer',
  team: 'Relief',
  portfolio: null,
  course: null,
  canManageBreaks: false,
  ...over,
});
const labels = (u: CurrentUser) => navFor(u).map((i) => i.label);

describe('navigation by tier (wireframes §C)', () => {
  it('volunteers see only floor tasks', () => {
    expect(labels(user({}))).toEqual(['My Duty', 'Count', 'Gifts']);
  });

  it('ICs add Team; the Welfare IC gets Breaks instead of Gifts', () => {
    expect(labels(user({ rank: 'ic', tier: 'ic' }))).toEqual(['My Duty', 'Count', 'Gifts', 'Team']);
    expect(
      labels(user({ rank: 'ic', tier: 'ic', team: 'Welfare', canManageBreaks: true })),
    ).toEqual(['My Duty', 'Count', 'Breaks', 'Team']);
  });

  it('admins see the coordination screens but not My Duty', () => {
    const admin = user({ rank: 'deputy', tier: 'admin', canManageBreaks: true });
    expect(labels(admin)).toEqual([
      'Dashboard',
      'Count',
      'Gifts',
      'Breaks',
      'Deployment',
      'People',
      'Setup',
      'Reports',
    ]);
    expect(homePathFor(admin)).toBe('/dashboard');
  });

  it('puts at most 3 items in the phone bar, the rest under More', () => {
    const { bar, more } = phoneNavFor(user({ rank: 'cc', tier: 'cc', canManageBreaks: true }));
    expect(bar.map((i) => i.label)).toEqual(['Dashboard', 'Count', 'Gifts']);
    expect(more.length).toBeGreaterThan(0);
  });
});
