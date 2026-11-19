import { describe, expect, it } from 'vitest';
import { hasTier, tierOf } from './permissions.js';

describe('tierOf', () => {
  it('maps deputies and shadow ICs to admin', () => {
    expect(tierOf('deputy')).toBe('admin');
    expect(tierOf('shadow_ic')).toBe('admin');
  });

  it('keeps CC above admin', () => {
    expect(tierOf('cc')).toBe('cc');
  });
});

describe('hasTier', () => {
  it('orders volunteer < ic < admin < cc', () => {
    expect(hasTier('cc', 'admin')).toBe(true);
    expect(hasTier('admin', 'cc')).toBe(false);
    expect(hasTier('ic', 'volunteer')).toBe(true);
    expect(hasTier('volunteer', 'ic')).toBe(false);
  });
});
