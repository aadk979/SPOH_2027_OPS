/**
 * Turns a person's assignment rows for one day into a timeline of posts (FR-DUTY-3).
 *
 * Rows are never edited, so the history stays complete. To read them, apply rows in the
 * order they were saved: a newer row replaces every post that starts at or after its own
 * start time. So "move to B from 13:00" followed later by "move to C now (11:00)" ends with
 * C for the rest of the day, as the Admin intended, instead of B coming back at 13:00.
 */

export interface AssignmentRow {
  stationId: string;
  effectiveFrom: Date;
  createdAt: Date;
}

export interface Post {
  stationId: string;
  from: Date;
}

export function resolveTimeline(rows: readonly AssignmentRow[]): Post[] {
  const ordered = [...rows].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
  );
  let posts: Post[] = [];
  for (const row of ordered) {
    const from = row.effectiveFrom.getTime();
    posts = posts.filter((p) => p.from.getTime() < from);
    posts.push({ stationId: row.stationId, from: row.effectiveFrom });
  }
  return posts.sort((a, b) => a.from.getTime() - b.from.getTime());
}

/**
 * The moment to read a day at: now while the day is running, its start before it begins,
 * its last moment once it is over. Any date works (C-7).
 */
export function viewInstant(now: Date, dayStart: Date, dayEnd: Date): Date {
  if (now < dayStart) return dayStart;
  if (now >= dayEnd) return new Date(dayEnd.getTime() - 1);
  return now;
}

/** The post at `at` (null if none has started yet) and the posts planned after it. */
export function postAt(posts: readonly Post[], at: Date): { current: Post | null; later: Post[] } {
  let current: Post | null = null;
  const later: Post[] = [];
  for (const p of posts) {
    if (p.from <= at) current = p;
    else later.push(p);
  }
  return { current, later };
}

/**
 * When a move "now" takes effect on a day: now while the day is running, otherwise the
 * start of the day (planning ahead, or correcting a finished day).
 */
export function effectiveNow(now: Date, dayStart: Date, dayEnd: Date): Date {
  return now >= dayStart && now < dayEnd ? now : dayStart;
}
