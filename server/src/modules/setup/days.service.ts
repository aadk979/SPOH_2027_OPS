import { and, count, eq, gte, lt, sql, sum } from 'drizzle-orm';
import {
  formatDayShort,
  type CurrentUser,
  type DayImpact,
  type DayInput,
  type DayPatch,
  type EventDayDto,
} from '@spoh/shared';
import type { Db } from '../../db/client.js';
import {
  assignment,
  breakPeriod,
  dutyChange,
  eventDay,
  footfall,
  person,
  registration,
} from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import { dayBounds } from '../deployment/posts.js';

type DayRow = typeof eventDay.$inferSelect;

/** Postgres returns time as HH:MM:SS; the app uses HH:MM. */
export function toDayDto(d: DayRow): EventDayDto {
  return {
    id: d.id,
    date: d.date,
    label: d.label,
    reportTime: d.reportTime?.slice(0, 5) ?? null,
    dismissTime: d.dismissTime?.slice(0, 5) ?? null,
  };
}

async function getDay(db: Db, id: string): Promise<DayRow> {
  const [row] = await db.select().from(eventDay).where(eq(eventDay.id, id));
  if (!row) throw notFound('Event day');
  return row;
}

async function assertDateFree(db: Db, date: string, exceptId?: string) {
  const [clash] = await db
    .select({ id: eventDay.id })
    .from(eventDay)
    .where(eq(eventDay.date, date));
  if (clash && clash.id !== exceptId) throw conflict(`${formatDayShort(date)} is already a day.`);
}

/** Adds a day. Everyone starts as not available on it until set (FR-CFG-5, FR-DUTY-1). */
export async function createDay(db: Db, actor: CurrentUser, input: DayInput) {
  await assertDateFree(db, input.date);
  const [created] = await db.insert(eventDay).values(input).returning();
  await audit(db, { actorId: actor.id, action: 'day.create', target: created!.id });
  return toDayDto(created!);
}

const show = (t: string | null) => t ?? 'not set';

/** What changed for volunteers, e.g. "Thu 7 Jan: report 09:00 → 08:30". Null if nothing. */
export function timingSummary(before: EventDayDto, after: EventDayDto): string | null {
  const parts: string[] = [];
  if (before.date !== after.date) parts.push(`moved to ${formatDayShort(after.date)}`);
  if (before.reportTime !== after.reportTime)
    parts.push(`report ${show(before.reportTime)} → ${show(after.reportTime)}`);
  if (before.dismissTime !== after.dismissTime)
    parts.push(`dismiss ${show(before.dismissTime)} → ${show(after.dismissTime)}`);
  return parts.length ? `${formatDayShort(before.date)}: ${parts.join(', ')}` : null;
}

/**
 * Edits a day. A date or time change creates a "Got it" change for everyone posted that
 * day (FR-CFG-5b → FR-DUTY-6); the email follows in slice S4.
 */
export async function updateDay(
  db: Db,
  now: Date,
  actor: CurrentUser,
  id: string,
  patch: DayPatch,
) {
  const existing = await getDay(db, id);
  if (patch.date) await assertDateFree(db, patch.date, id);

  return db.transaction(async (tx) => {
    const [updated] = await tx.update(eventDay).set(patch).where(eq(eventDay.id, id)).returning();
    const summary = timingSummary(toDayDto(existing), toDayDto(updated!));
    if (summary) {
      const posted = await tx
        .selectDistinct({ personId: assignment.personId })
        .from(assignment)
        .where(eq(assignment.dayId, id));
      if (posted.length > 0) {
        await tx.insert(dutyChange).values(
          posted.map((p) => ({
            personId: p.personId,
            dayId: id,
            kind: 'timing' as const,
            summary,
            createdBy: actor.id,
            createdAt: now,
          })),
        );
      }
    }
    await audit(tx, {
      actorId: actor.id,
      action: 'day.update',
      target: id,
      details: { fields: Object.keys(patch), notified: summary !== null },
    });
    return toDayDto(updated!);
  });
}

const n = (v: number | string | null | undefined) => Number(v ?? 0);

/** What removing a day touches (FR-CFG-5a). Counts are by time, so they are always kept. */
export async function dayImpact(db: Db, id: string): Promise<DayImpact> {
  const day = await getDay(db, id);
  const { start, end } = dayBounds(day);
  const [a] = await db.select({ n: count() }).from(assignment).where(eq(assignment.dayId, id));
  const [b] = await db.select({ n: count() }).from(breakPeriod).where(eq(breakPeriod.dayId, id));
  const [c] = await db.select({ n: count() }).from(dutyChange).where(eq(dutyChange.dayId, id));
  const [p] = await db
    .select({ n: count() })
    .from(person)
    .where(sql`${id}::uuid = any(${person.availableDayIds})`);
  const [r] = await db
    .select({ n: count() })
    .from(registration)
    .where(and(gte(registration.recordedAt, start), lt(registration.recordedAt, end)));
  const [f] = await db
    .select({ n: sum(footfall.count) })
    .from(footfall)
    .where(and(gte(footfall.recordedAt, start), lt(footfall.recordedAt, end)));
  return {
    assignments: n(a?.n),
    breaks: n(b?.n),
    dutyChanges: n(c?.n),
    availablePeople: n(p?.n),
    registrationsKept: n(r?.n),
    footfallKept: n(f?.n),
  };
}

/**
 * Removes a day and its assignments, breaks and changes. If any of those exist the caller
 * must pass confirm=true after showing the impact (FR-CFG-5a). Counts are never deleted.
 */
export async function deleteDay(db: Db, actor: CurrentUser, id: string, confirm: boolean) {
  const impact = await dayImpact(db, id);
  const touches = impact.assignments + impact.breaks + impact.dutyChanges;
  if (touches > 0 && !confirm) {
    throw new AppError(409, 'CONFIRM_REQUIRED', 'This day has data. Confirm to remove it.', impact);
  }
  await db.transaction(async (tx) => {
    await tx
      .update(person)
      .set({ availableDayIds: sql`array_remove(${person.availableDayIds}, ${id}::uuid)` })
      .where(sql`${id}::uuid = any(${person.availableDayIds})`);
    await tx.delete(eventDay).where(eq(eventDay.id, id)); // cascades to day-linked rows
    await audit(tx, { actorId: actor.id, action: 'day.delete', target: id, details: impact });
  });
  return impact;
}
