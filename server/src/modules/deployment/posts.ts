import { and, inArray } from 'drizzle-orm';
import { sgtInstant } from '@spoh/shared';
import type { Db } from '../../db/client.js';
import type { eventDay } from '../../db/schema/index.js';
import { assignment } from '../../db/schema/index.js';
import { postAt, resolveTimeline, viewInstant, type Post } from './timeline.js';

type DayRow = Pick<typeof eventDay.$inferSelect, 'id' | 'date'>;

/** [00:00 SGT, next 00:00 SGT) of an event day. */
export function dayBounds(day: Pick<DayRow, 'date'>): { start: Date; end: Date } {
  const start = sgtInstant(day.date, '00:00');
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

const key = (personId: string, dayId: string) => `${personId}|${dayId}`;

/** Every person's timeline on the given days, keyed by person and day. */
export async function loadPosts(
  db: Db,
  dayIds: readonly string[],
  personIds?: readonly string[],
): Promise<Map<string, Post[]>> {
  if (dayIds.length === 0 || personIds?.length === 0) return new Map();
  const rows = await db
    .select()
    .from(assignment)
    .where(
      and(
        inArray(assignment.dayId, [...dayIds]),
        personIds ? inArray(assignment.personId, [...personIds]) : undefined,
      ),
    );
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = key(r.personId, r.dayId);
    grouped.set(k, [...(grouped.get(k) ?? []), r]);
  }
  const out = new Map<string, Post[]>();
  for (const [k, list] of grouped) out.set(k, resolveTimeline(list));
  return out;
}

/** A person's post on a day as seen at `now` (see viewInstant), plus moves planned later. */
export function readDay(
  posts: Map<string, Post[]>,
  personId: string,
  day: DayRow,
  now: Date,
): { current: Post | null; later: Post[] } {
  const { start, end } = dayBounds(day);
  return postAt(posts.get(key(personId, day.id)) ?? [], viewInstant(now, start, end));
}
