import { describe, expect, it } from 'vitest';
import { formatDayShort, pickDefaultDay, TIME_PATTERN } from './days.js';

const days = [{ date: '2027-01-08' }, { date: '2027-01-06' }, { date: '2027-01-07' }];

describe('formatDayShort', () => {
  it('formats a date as weekday, day and month', () => {
    expect(formatDayShort('2027-01-07')).toBe('Thu 7 Jan');
    expect(formatDayShort('2026-12-12')).toBe('Sat 12 Dec');
  });
});

describe('pickDefaultDay', () => {
  it('prefers today, then the next day, then the last day (works on any date, C-7)', () => {
    expect(pickDefaultDay(days, '2027-01-07')?.date).toBe('2027-01-07');
    expect(pickDefaultDay(days, '2026-11-20')?.date).toBe('2027-01-06');
    expect(pickDefaultDay(days, '2027-02-01')?.date).toBe('2027-01-08');
    expect(pickDefaultDay([], '2027-01-07')).toBeNull();
  });
});

describe('TIME_PATTERN', () => {
  it('accepts 24-hour HH:MM only', () => {
    expect(TIME_PATTERN.test('09:00')).toBe(true);
    expect(TIME_PATTERN.test('23:59')).toBe(true);
    expect(TIME_PATTERN.test('24:00')).toBe(false);
    expect(TIME_PATTERN.test('9:00')).toBe(false);
  });
});
