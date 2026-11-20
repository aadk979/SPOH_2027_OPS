import { and, eq, inArray } from 'drizzle-orm';
import {
  formatDayShort,
  sgtInstant,
  sgtTimeString,
  type AddBreakBody,
  type BreakSlot,
  type CurrentUser,
  type EditSlotBody,
  type SlotRef,
} from '@spoh/shared';
import type { Db, Tx } from '../../db/client.js';
import { breakPeriod, dutyChange, eventDay, person, station } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
import { AppError, notFound } from '../../lib/errors.js';
import { loadPosts } from '../deployment/posts.js';
import { postAt } from '../deployment/timeline.js';
import { coverageGaps, type BreakSpan } from './coverage.js';

type DayRow = typeof eventDay.$inferSelect;
type BreakRow = typeof breakPeriod.$inferSelect;

async function getDay(db: Db, dayId: string): Promise<DayRow> {
  const [day] = await db.select().from(eventDay).where(eq(eventDay.id, dayId));
  if (!day) throw notFound('Event day');
  return day;
}

const span = (day: DayRow, start: string, end: string) => ({
  start: sgtInstant(day.date, start),
  end: sgtInstant(day.date, end),
});
const describe = (start: string, end: string, label: string) =>
  `Break ${start}–${end}${label ? ` (${label})` : ''}`;
const timesOf = (b: BreakRow) => ({
  start: sgtTimeString(b.startsAt),
  end: sgtTimeString(b.endsAt),
});
const sameSlot = (b: BreakRow, ref: SlotRef) => {
  const t = timesOf(b);
  return t.start === ref.start && t.end === ref.end && (b.label ?? '') === ref.label;
};

async function dayBreaks(db: Db, dayId: string) {
  return db.select().from(breakPeriod).where(eq(breakPeriod.dayId, dayId));
}

async function warnIfUncovered(
  db: Db,
  day: DayRow,
  breaks: BreakSpan[],
  affected: string[],
  window: { start: Date; end: Date },
  override: boolean,
) {
  if (override || affected.length === 0) return;
  const gaps = await coverageGaps(db, day.id, breaks, new Set(affected), window);
  if (gaps.length > 0) {
    const list = gaps.map((g) => `${g.station} (from ${g.at})`).join(', ');
    throw new AppError(409, 'COVERAGE_GAP', `Nobody would be left at ${list}.`, gaps);
  }
}

async function tell(
  tx: Tx,
  now: Date,
  actor: CurrentUser,
  day: DayRow,
  ids: string[],
  what: string,
) {
  if (ids.length === 0) return;
  await tx.insert(dutyChange).values(
    ids.map((personId) => ({
      personId,
      dayId: day.id,
      kind: 'break' as const,
      summary: `${formatDayShort(day.date)}: ${what}`,
      createdBy: actor.id,
      createdAt: now,
    })),
  );
}

/** Everyone the body picks: by name, by team, and by station at the break's start (FR-BRK-2). */
async function resolvePeople(db: Db, day: DayRow, body: AddBreakBody, at: Date) {
  const ids = new Set(body.personIds);
  if (body.teams.length > 0) {
    const rows = await db
      .select({ id: person.id })
      .from(person)
      .where(inArray(person.team, body.teams));
    rows.forEach((r) => ids.add(r.id));
  }
  if (body.stationIds.length > 0) {
    for (const [key, timeline] of await loadPosts(db, [day.id])) {
      const at_ = postAt(timeline, at).current?.stationId;
      if (at_ && body.stationIds.includes(at_)) ids.add(key.split('|')[0]!);
    }
  }
  if (ids.size === 0) return [];
  const active = await db
    .select({ id: person.id })
    .from(person)
    .where(and(inArray(person.id, [...ids]), eq(person.active, true)));
  return active.map((r) => r.id);
}

export async function listSlots(db: Db, dayId: string): Promise<BreakSlot[]> {
  const day = await getDay(db, dayId);
  const rows = await db
    .select({ b: breakPeriod, name: person.name, team: person.team })
    .from(breakPeriod)
    .innerJoin(person, eq(person.id, breakPeriod.personId))
    .where(and(eq(breakPeriod.dayId, dayId), eq(person.active, true)));
  const [posts, stations] = await Promise.all([
    loadPosts(db, [day.id]),
    db.select({ id: station.id, name: station.name }).from(station),
  ]);
  const names = new Map(stations.map((s) => [s.id, s.name]));

  const slots = new Map<string, BreakSlot>();
  for (const { b, name, team } of rows) {
    const { start, end } = timesOf(b);
    const label = b.label ?? '';
    const key = `${start}|${end}|${label}`;
    const slot = slots.get(key) ?? { start, end, label, people: [] };
    const at = postAt(posts.get(`${b.personId}|${day.id}`) ?? [], b.startsAt).current;
    slot.people.push({
      breakId: b.id,
      personId: b.personId,
      name,
      team,
      stationName: at ? (names.get(at.stationId) ?? null) : null,
    });
    slots.set(key, slot);
  }
  return [...slots.values()]
    .map((s) => ({ ...s, people: s.people.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export async function addBreak(db: Db, now: Date, actor: CurrentUser, body: AddBreakBody) {
  const day = await getDay(db, body.dayId);
  const window = span(day, body.start, body.end);
  const people = await resolvePeople(db, day, body, window.start);
  const existing = await dayBreaks(db, day.id);
  const already = new Set(
    existing
      .filter(
        (b) =>
          b.startsAt.getTime() === window.start.getTime() &&
          b.endsAt.getTime() === window.end.getTime(),
      )
      .map((b) => b.personId),
  );
  const toAdd = people.filter((id) => !already.has(id));
  const proposed = [
    ...existing,
    ...toAdd.map((personId) => ({ personId, startsAt: window.start, endsAt: window.end })),
  ];
  await warnIfUncovered(db, day, proposed, toAdd, window, body.override);

  if (toAdd.length > 0) {
    await db.transaction(async (tx) => {
      await tx.insert(breakPeriod).values(
        toAdd.map((personId) => ({
          personId,
          dayId: day.id,
          startsAt: window.start,
          endsAt: window.end,
          label: body.label || null,
          createdBy: actor.id,
        })),
      );
      await tell(tx, now, actor, day, toAdd, `${describe(body.start, body.end, body.label)} added`);
      await audit(tx, {
        actorId: actor.id,
        action: 'break.add',
        target: day.id,
        details: { people: toAdd.length, start: body.start, end: body.end },
      });
    });
  }
  return { added: toAdd.length, unchanged: people.length - toAdd.length };
}

export async function editSlot(db: Db, now: Date, actor: CurrentUser, body: EditSlotBody) {
  const day = await getDay(db, body.slot.dayId);
  const existing = await dayBreaks(db, day.id);
  const inSlot = existing.filter((b) => sameSlot(b, body.slot));
  if (inSlot.length === 0) throw notFound('Break');
  const window = span(day, body.to.start, body.to.end);
  const ids = new Set(inSlot.map((b) => b.id));
  const proposed = existing.map((b) =>
    ids.has(b.id) ? { ...b, startsAt: window.start, endsAt: window.end } : b,
  );
  const people = inSlot.map((b) => b.personId);
  await warnIfUncovered(db, day, proposed, people, window, body.override);

  const was = describe(body.slot.start, body.slot.end, body.slot.label);
  const timesChanged = body.to.start !== body.slot.start || body.to.end !== body.slot.end;
  await db.transaction(async (tx) => {
    await tx
      .update(breakPeriod)
      .set({ startsAt: window.start, endsAt: window.end, label: body.to.label || null })
      .where(inArray(breakPeriod.id, [...ids]));
    // A label-only edit changes nothing for the volunteer, so nobody is asked to acknowledge it.
    if (timesChanged)
      await tell(tx, now, actor, day, people, `${was} moved to ${body.to.start}–${body.to.end}`);
    await audit(tx, {
      actorId: actor.id,
      action: 'break.edit',
      target: day.id,
      details: { from: body.slot, to: body.to },
    });
  });
  return { updated: inSlot.length };
}

async function removeRows(db: Db, now: Date, actor: CurrentUser, day: DayRow, rows: BreakRow[]) {
  await db.transaction(async (tx) => {
    await tx.delete(breakPeriod).where(
      inArray(
        breakPeriod.id,
        rows.map((b) => b.id),
      ),
    );
    for (const b of rows) {
      const { start, end } = timesOf(b);
      await tell(
        tx,
        now,
        actor,
        day,
        [b.personId],
        `${describe(start, end, b.label ?? '')} removed`,
      );
    }
    await audit(tx, {
      actorId: actor.id,
      action: 'break.remove',
      target: day.id,
      details: { count: rows.length },
    });
  });
  return { removed: rows.length };
}

export async function removeSlot(db: Db, now: Date, actor: CurrentUser, ref: SlotRef) {
  const day = await getDay(db, ref.dayId);
  const rows = (await dayBreaks(db, day.id)).filter((b) => sameSlot(b, ref));
  if (rows.length === 0) throw notFound('Break');
  return removeRows(db, now, actor, day, rows);
}

export async function removeOne(db: Db, now: Date, actor: CurrentUser, breakId: string) {
  const [row] = await db.select().from(breakPeriod).where(eq(breakPeriod.id, breakId));
  if (!row) throw notFound('Break');
  return removeRows(db, now, actor, await getDay(db, row.dayId), [row]);
}

/** FR-BRK-5: who is on a break at `at`, mapped to when it ends (HH:MM). */
export async function onBreakAt(db: Db, dayId: string, at: Date): Promise<Map<string, string>> {
  const rows = await dayBreaks(db, dayId);
  return new Map(
    rows
      .filter((b) => b.startsAt <= at && at < b.endsAt)
      .map((b) => [b.personId, sgtTimeString(b.endsAt)]),
  );
}
