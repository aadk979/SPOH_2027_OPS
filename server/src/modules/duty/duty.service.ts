import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  pickDefaultDay,
  sgtDateString,
  sgtTimeString,
  type CurrentUser,
  type DutyDay,
  type DutyStation,
  type MyDutyResponse,
  type TeamResponse,
} from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { breakPeriod, dutyChange, person, station } from '../../db/schema/index.js';
import { notFound } from '../../lib/errors.js';
import { listEventDays } from '../config/app-config.js';
import { toDayDto } from '../setup/days.service.js';
import { loadPosts, readDay } from '../deployment/posts.js';

async function stationLookup(db: Db): Promise<(id: string) => DutyStation> {
  const rows = await db
    .select({ id: station.id, name: station.name, room: station.room })
    .from(station);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (id) => byId.get(id) ?? { id, name: 'Unknown station', room: '' };
}

async function teamICs(db: Db, team: string | null, exceptId: string): Promise<string[]> {
  if (!team) return [];
  const rows = await db
    .select({ id: person.id, name: person.name })
    .from(person)
    .where(and(eq(person.team, team), eq(person.rank, 'ic'), eq(person.active, true)))
    .orderBy(asc(person.name));
  return rows.filter((r) => r.id !== exceptId).map((r) => r.name);
}

/** Everything a volunteer needs about their duty, for every configured day (FR-DUTY-5). */
export async function myDuty(db: Db, now: Date, userId: string): Promise<MyDutyResponse> {
  const [me] = await db.select().from(person).where(eq(person.id, userId));
  if (!me) throw notFound('Person');
  const days = await listEventDays(db);
  const posts = await loadPosts(
    db,
    days.map((d) => d.id),
    [me.id],
  );
  const lookup = await stationLookup(db);
  const breaks = await db
    .select()
    .from(breakPeriod)
    .where(eq(breakPeriod.personId, me.id))
    .orderBy(asc(breakPeriod.startsAt));

  const dutyDays: DutyDay[] = days.map((day) => {
    const { current, later } = readDay(posts, me.id, day, now);
    return {
      day: toDayDto(day),
      available: me.availableDayIds.includes(day.id),
      station: current ? lookup(current.stationId) : null,
      later: later.map((l) => ({ from: sgtTimeString(l.from), station: lookup(l.stationId) })),
      breaks: breaks
        .filter((b) => b.dayId === day.id)
        .map((b) => ({
          start: sgtTimeString(b.startsAt),
          end: sgtTimeString(b.endsAt),
          label: b.label,
        })),
    };
  });

  const pending = await db
    .select({ change: dutyChange, by: person.name })
    .from(dutyChange)
    .leftJoin(person, eq(person.id, dutyChange.createdBy))
    .where(and(eq(dutyChange.personId, me.id), isNull(dutyChange.acknowledgedAt)))
    .orderBy(desc(dutyChange.createdAt));

  const today = sgtDateString(now);
  return {
    team: me.team,
    icNames: await teamICs(db, me.team, me.id),
    defaultDayId: pickDefaultDay(days, today)?.id ?? null,
    todayDayId: days.find((d) => d.date === today)?.id ?? null,
    days: dutyDays,
    pending: pending.map(({ change, by }) => ({
      id: change.id,
      kind: change.kind,
      summary: change.summary,
      createdAt: change.createdAt.toISOString(),
      createdBy: by,
    })),
  };
}

/** "Got it" (FR-DUTY-7). Only the person's own changes; already-acknowledged ones are kept. */
export async function acknowledge(
  db: Db,
  now: Date,
  userId: string,
  ids: readonly string[],
): Promise<number> {
  const updated = await db
    .update(dutyChange)
    .set({ acknowledgedAt: now })
    .where(
      and(
        inArray(dutyChange.id, [...ids]),
        eq(dutyChange.personId, userId),
        isNull(dutyChange.acknowledgedAt),
      ),
    )
    .returning({ id: dutyChange.id });
  return updated.length;
}

/**
 * The IC's own team on a day, with contact details (FR-DUTY-10). Contact details only
 * ever go to someone of IC tier or above, and only for their own team.
 */
export async function teamView(
  db: Db,
  now: Date,
  user: CurrentUser,
  dayId: string | undefined,
): Promise<TeamResponse> {
  const [me] = await db.select({ team: person.team }).from(person).where(eq(person.id, user.id));
  const days = await listEventDays(db);
  const day = dayId
    ? days.find((d) => d.id === dayId)
    : (pickDefaultDay(days, sgtDateString(now)) ?? undefined);
  if (dayId && !day) throw notFound('Event day');
  const team = me?.team ?? null;
  if (!team || !day) return { team, day: day ? toDayDto(day) : null, members: [] };

  const members = await db
    .select()
    .from(person)
    .where(and(eq(person.team, team), eq(person.active, true)))
    .orderBy(asc(person.name));
  const ids = members.map((m) => m.id);
  const posts = await loadPosts(db, [day.id], ids);
  const lookup = await stationLookup(db);
  const unacked = ids.length
    ? await db
        .select({ personId: dutyChange.personId, createdAt: dutyChange.createdAt })
        .from(dutyChange)
        .where(and(inArray(dutyChange.personId, ids), isNull(dutyChange.acknowledgedAt)))
        .orderBy(asc(dutyChange.createdAt))
    : [];

  return {
    team,
    day: toDayDto(day),
    members: members.map((m) => {
      const current = readDay(posts, m.id, day, now).current;
      const mine = unacked.filter((u) => u.personId === m.id);
      return {
        id: m.id,
        name: m.name,
        rank: m.rank,
        email: m.email,
        phone: m.phone,
        available: m.availableDayIds.includes(day.id),
        station: current ? lookup(current.stationId) : null,
        unacked: mine.length,
        oldestUnackedAt: mine[0]?.createdAt.toISOString() ?? null,
      };
    }),
  };
}
