import { eq } from 'drizzle-orm';
import { sgtTimeString, type CoverageGap } from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { person, station } from '../../db/schema/index.js';
import { loadPosts } from '../deployment/posts.js';
import { postAt } from '../deployment/timeline.js';

export interface BreakSpan {
  personId: string;
  startsAt: Date;
  endsAt: Date;
}

const covers = (b: BreakSpan, t: Date) => b.startsAt <= t && t < b.endsAt;

/**
 * FR-BRK-4: stations that would have nobody on them because everyone posted there is on a
 * break. `breaks` is the whole day as it would be after the change; only stations where one
 * of `affected` is posted are reported, and only moments inside `window` are checked
 * (its start, plus every break boundary inside it, which is where coverage can change).
 */
export async function coverageGaps(
  db: Db,
  dayId: string,
  breaks: readonly BreakSpan[],
  affected: ReadonlySet<string>,
  window: { start: Date; end: Date },
): Promise<CoverageGap[]> {
  const [posts, active, stations] = await Promise.all([
    loadPosts(db, [dayId]),
    db.select({ id: person.id }).from(person).where(eq(person.active, true)),
    db.select({ id: station.id, name: station.name }).from(station),
  ]);
  const isActive = new Set(active.map((p) => p.id));
  const names = new Map(stations.map((s) => [s.id, s.name]));

  const moments = [window.start];
  for (const b of breaks) {
    for (const t of [b.startsAt, b.endsAt]) if (t > window.start && t < window.end) moments.push(t);
  }

  const gaps = new Map<string, CoverageGap>();
  for (const t of moments.sort((a, b) => a.getTime() - b.getTime())) {
    const staff = new Map<string, string[]>();
    for (const [key, timeline] of posts) {
      const personId = key.split('|')[0]!;
      const at = postAt(timeline, t).current?.stationId;
      if (!at || !isActive.has(personId)) continue;
      staff.set(at, [...(staff.get(at) ?? []), personId]);
    }
    for (const [stationId, people] of staff) {
      if (gaps.has(stationId) || !people.some((p) => affected.has(p))) continue;
      const allAway = people.every((p) => breaks.some((b) => b.personId === p && covers(b, t)));
      if (allAway) {
        gaps.set(stationId, {
          stationId,
          station: names.get(stationId) ?? '?',
          at: sgtTimeString(t),
        });
      }
    }
  }
  return [...gaps.values()];
}
