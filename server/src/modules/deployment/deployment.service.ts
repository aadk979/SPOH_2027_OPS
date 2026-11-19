import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import {
  formatDayShort,
  sgtInstant,
  sgtTimeString,
  type AssignBody,
  type AssignResponse,
  type BoardPerson,
  type CurrentUser,
  type NotAvailableDetails,
  type UnackedChange,
} from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { assignment, dutyChange, eventDay, person, station } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { getStation } from '../stations/stations.service.js';
import { dayBounds, loadPosts, readDay } from './posts.js';
import { effectiveNow, postAt } from './timeline.js';

type DayRow = typeof eventDay.$inferSelect;

async function stationNames(db: Db): Promise<Map<string, string>> {
  const rows = await db.select({ id: station.id, name: station.name }).from(station);
  return new Map(rows.map((r) => [r.id, r.name]));
}

function startOf(day: DayRow, from: AssignBody['from'], now: Date): Date {
  const { start, end } = dayBounds(day);
  return from === 'now' ? effectiveNow(now, start, end) : sgtInstant(day.date, from);
}

/**
 * Assign or move people to a station on one or more days (FR-DUTY-2/3/4). Adds rows,
 * never edits them, and records one change per person per day for "Got it" (FR-DUTY-6).
 */
export async function assign(
  db: Db,
  actor: CurrentUser,
  now: Date,
  body: AssignBody,
): Promise<AssignResponse> {
  const target = await getStation(db, body.stationId);
  if (!target.active) throw badRequest(`${target.name} is closed. Pick another station.`);

  const days = await db.select().from(eventDay).where(inArray(eventDay.id, body.dayIds));
  if (days.length !== new Set(body.dayIds).size) throw notFound('Event day');
  const people = await db.select().from(person).where(inArray(person.id, body.personIds));
  if (people.length !== new Set(body.personIds).size || people.some((p) => !p.active)) {
    throw badRequest('Someone in the list is no longer on the roster. Refresh and try again.');
  }

  const notAvailable: NotAvailableDetails = people.flatMap((p) =>
    days
      .filter((d) => !p.availableDayIds.includes(d.id))
      .map((d) => ({ personId: p.id, name: p.name, dayId: d.id, day: formatDayShort(d.date) })),
  );
  if (notAvailable.length > 0 && !body.override) {
    throw new AppError(
      409,
      'NOT_AVAILABLE',
      'Some people are not available on the chosen days.',
      notAvailable,
    );
  }

  const posts = await loadPosts(
    db,
    days.map((d) => d.id),
    people.map((p) => p.id),
  );
  const names = await stationNames(db);
  const rows: (typeof assignment.$inferInsert)[] = [];
  const changes: (typeof dutyChange.$inferInsert)[] = [];

  for (const day of days) {
    const dayStart = dayBounds(day).start;
    for (const p of people) {
      const from = startOf(day, body.from, now);
      const timeline = posts.get(`${p.id}|${day.id}`) ?? [];
      const { current, later } = postAt(timeline, from);
      if (current?.stationId === body.stationId && later.length === 0) continue;

      rows.push({
        personId: p.id,
        dayId: day.id,
        stationId: body.stationId,
        effectiveFrom: from,
        createdBy: actor.id,
      });
      const when = from.getTime() === dayStart.getTime() ? '' : ` from ${sgtTimeString(from)}`;
      const was = current ? `${names.get(current.stationId) ?? 'Unknown'} → ` : '';
      changes.push({
        personId: p.id,
        dayId: day.id,
        kind: 'assignment',
        summary: `${formatDayShort(day.date)}: ${was}${target.name}${when}`,
        createdBy: actor.id,
      });
    }
  }

  if (rows.length > 0) {
    await db.transaction(async (tx) => {
      await tx.insert(assignment).values(rows);
      await tx.insert(dutyChange).values(changes);
      await audit(tx, {
        actorId: actor.id,
        action: 'assignment.create',
        target: body.stationId,
        details: {
          people: body.personIds.length,
          days: body.dayIds,
          from: body.from,
          saved: rows.length,
          overrodeAvailability: notAvailable.length > 0,
        },
      });
    });
  }
  return { assigned: rows.length, unchanged: people.length * days.length - rows.length };
}

async function unackedByPerson(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ personId: dutyChange.personId })
    .from(dutyChange)
    .where(isNull(dutyChange.acknowledgedAt));
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.personId, (counts.get(r.personId) ?? 0) + 1);
  return counts;
}

/** Everyone active, with where they are on the day and any moves planned later. */
export async function board(db: Db, now: Date, dayId: string): Promise<BoardPerson[]> {
  const [day] = await db.select().from(eventDay).where(eq(eventDay.id, dayId));
  if (!day) throw notFound('Event day');
  const people = await db
    .select()
    .from(person)
    .where(eq(person.active, true))
    .orderBy(asc(person.name));
  const posts = await loadPosts(db, [day.id]);
  const unacked = await unackedByPerson(db);

  return people.map((p) => {
    const { current, later } = readDay(posts, p.id, day, now);
    return {
      id: p.id,
      name: p.name,
      rank: p.rank,
      team: p.team,
      available: p.availableDayIds.includes(day.id),
      stationId: current?.stationId ?? null,
      later: later.map((l) => ({ from: sgtTimeString(l.from), stationId: l.stationId })),
      unacked: unacked.get(p.id) ?? 0,
    };
  });
}

/** Changes nobody has tapped "Got it" on yet, oldest first (FR-DUTY-8). */
export async function unackedChanges(
  db: Db,
  now: Date,
  filter: { stationId?: string | undefined; team?: string | undefined },
): Promise<UnackedChange[]> {
  const rows = await db
    .select({ change: dutyChange, name: person.name, team: person.team })
    .from(dutyChange)
    .innerJoin(person, eq(person.id, dutyChange.personId))
    .where(and(isNull(dutyChange.acknowledgedAt), eq(person.active, true)))
    .orderBy(asc(dutyChange.createdAt));

  const dayIds = [...new Set(rows.flatMap((r) => (r.change.dayId ? [r.change.dayId] : [])))];
  const days = dayIds.length
    ? await db.select().from(eventDay).where(inArray(eventDay.id, dayIds))
    : [];
  const dayById = new Map(days.map((d) => [d.id, d]));
  const posts = await loadPosts(db, dayIds);

  return rows
    .map(({ change, name, team }) => {
      const day = change.dayId ? dayById.get(change.dayId) : undefined;
      const stationId = day
        ? (readDay(posts, change.personId, day, now).current?.stationId ?? null)
        : null;
      return {
        id: change.id,
        personId: change.personId,
        name,
        team,
        stationId,
        kind: change.kind,
        summary: change.summary,
        createdAt: change.createdAt.toISOString(),
      };
    })
    .filter(
      (c) =>
        (!filter.team || c.team === filter.team) &&
        (!filter.stationId || c.stationId === filter.stationId),
    );
}
