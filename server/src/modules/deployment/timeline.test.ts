import { describe, expect, it } from 'vitest';
import { effectiveNow, postAt, resolveTimeline, viewInstant } from './timeline.js';

const t = (hhmm: string) => new Date(`2027-01-07T${hhmm}:00+08:00`);
const row = (stationId: string, from: string, saved: string) => ({
  stationId,
  effectiveFrom: t(from),
  createdAt: t(saved),
});

describe('resolveTimeline', () => {
  it('keeps a planned later move', () => {
    const posts = resolveTimeline([row('A', '00:00', '08:00'), row('B', '13:00', '09:00')]);
    expect(posts.map((p) => p.stationId)).toEqual(['A', 'B']);
    expect(postAt(posts, t('10:00')).current?.stationId).toBe('A');
    expect(postAt(posts, t('10:00')).later.map((p) => p.stationId)).toEqual(['B']);
    expect(postAt(posts, t('13:00')).current?.stationId).toBe('B');
  });

  it('a newer move replaces posts that start at or after it', () => {
    const posts = resolveTimeline([
      row('A', '00:00', '08:00'),
      row('B', '13:00', '09:00'),
      row('C', '11:00', '11:00'),
    ]);
    expect(posts.map((p) => p.stationId)).toEqual(['A', 'C']);
    expect(postAt(posts, t('14:00')).current?.stationId).toBe('C');
  });

  it('re-planning the whole day replaces everything', () => {
    const posts = resolveTimeline([row('A', '00:00', '08:00'), row('B', '00:00', '08:30')]);
    expect(posts).toEqual([{ stationId: 'B', from: t('00:00') }]);
  });

  it('has no post before the first one starts', () => {
    const posts = resolveTimeline([row('A', '12:00', '08:00')]);
    expect(postAt(posts, t('10:00')).current).toBeNull();
    expect(postAt([], t('10:00'))).toEqual({ current: null, later: [] });
  });
});

describe('viewInstant and effectiveNow', () => {
  const start = t('00:00');
  const end = new Date(start.getTime() + 86_400_000);

  it('reads a running day at now, a future day at its start, a past day at its end', () => {
    expect(viewInstant(t('10:00'), start, end)).toEqual(t('10:00'));
    expect(viewInstant(new Date('2026-12-12T02:00:00Z'), start, end)).toEqual(start);
    expect(viewInstant(new Date('2027-02-01T02:00:00Z'), start, end).getTime()).toBe(
      end.getTime() - 1,
    );
  });

  it('a move "now" on a day that is not running starts at the beginning of that day', () => {
    expect(effectiveNow(t('10:00'), start, end)).toEqual(t('10:00'));
    expect(effectiveNow(new Date('2026-12-12T02:00:00Z'), start, end)).toEqual(start);
    expect(effectiveNow(new Date('2027-02-01T02:00:00Z'), start, end)).toEqual(start);
  });
});
