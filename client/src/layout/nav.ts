import { hasTier, type CurrentUser, type Tier } from '@spoh/shared';

export interface NavItem {
  to: string;
  label: string;
  /** Minimum tier that sees this item. */
  tier: Tier;
  /** Extra condition beyond tier (e.g. Welfare IC for Breaks). */
  when?: (user: CurrentUser) => boolean;
  /** Shown in the phone bottom bar (max 4); others go under "More". */
  phone?: boolean;
}

/** Single source of truth for navigation (wireframes §C "Navigation by tier"). */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', tier: 'admin', phone: true },
  {
    to: '/duty',
    label: 'My Duty',
    tier: 'volunteer',
    phone: true,
    when: (u) => !hasTier(u.tier, 'admin'),
  },
  { to: '/count', label: 'Count', tier: 'volunteer', phone: true },
  {
    to: '/gifts',
    label: 'Gifts',
    tier: 'volunteer',
    phone: true,
    when: (u) => !u.canManageBreaks || hasTier(u.tier, 'admin'),
  },
  { to: '/breaks', label: 'Breaks', tier: 'ic', phone: true, when: (u) => u.canManageBreaks },
  { to: '/team', label: 'Team', tier: 'ic', when: (u) => u.tier === 'ic' },
  { to: '/deployment', label: 'Deployment', tier: 'admin' },
  { to: '/people', label: 'People', tier: 'admin' },
  { to: '/setup', label: 'Setup', tier: 'admin' },
  { to: '/reports', label: 'Reports', tier: 'admin' },
];

export function navFor(user: CurrentUser): NavItem[] {
  return NAV_ITEMS.filter((item) => hasTier(user.tier, item.tier) && (item.when?.(user) ?? true));
}

/** Up to 4 items for the phone bottom bar; the rest live under "More". */
export function phoneNavFor(user: CurrentUser): { bar: NavItem[]; more: NavItem[] } {
  const items = navFor(user);
  const bar = items.filter((i) => i.phone).slice(0, 3);
  const more = items.filter((i) => !bar.includes(i));
  return { bar, more };
}

/** Where a user lands after signing in. */
export function homePathFor(user: CurrentUser): string {
  return hasTier(user.tier, 'admin') ? '/dashboard' : '/duty';
}
