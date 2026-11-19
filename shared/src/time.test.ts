import { describe, expect, it } from 'vitest';
import { endOfSgtDay, sgtDateString, sgtDayBounds, sgtInstant, sgtTimeString } from './time.js';

describe('SGT time helpers', () => {
  it('uses the Singapore date, not the UTC date', () => {
    // 17:30 UTC on 6 Jan is already 01:30 on 7 Jan in Singapore.
    expect(sgtDateString(new Date('2027-01-06T17:30:00Z'))).toBe('2027-01-07');
  });

  it('ends a session at 23:59:59.999 SGT', () => {
    const tenAmSgt = new Date('2027-01-07T02:00:00Z');
    expect(endOfSgtDay(tenAmSgt).toISOString()).toBe('2027-01-07T15:59:59.999Z');
  });

  it('round-trips an SGT date and time', () => {
    const nineAm = sgtInstant('2027-01-07', '09:00');
    expect(nineAm.toISOString()).toBe('2027-01-07T01:00:00.000Z');
    expect(sgtTimeString(nineAm)).toBe('09:00');
  });

  it('gives the Singapore day as a half-open UTC range', () => {
    const lateNight = new Date('2027-01-06T17:30:00Z'); // 01:30 SGT on 7 Jan
    const { date, start, end } = sgtDayBounds(lateNight);
    expect(date).toBe('2027-01-07');
    expect(start.toISOString()).toBe('2027-01-06T16:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-07T16:00:00.000Z');
  });
});
