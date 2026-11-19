import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import {
  REG_CATEGORIES,
  sgtDayBounds,
  type CreateCountsResponse,
  type CurrentUser,
  type RegCategory,
  type RegistrationSummary,
  type SummaryQuery,
} from '@spoh/shared';
import type { AppDeps } from '../../deps.js';
import { registration } from '../../db/schema/index.js';
import { notFound } from '../../lib/errors.js';
import { assertUndoable } from '../../lib/undo.js';
import { getStationOfKind } from '../stations/stations.service.js';

/*
 * Registration = one anonymous visitor category per row (FR-REG-*).
 * RULE 1: nothing here reads or returns footfall. RULE 2: no visitor data is stored.
 */

export interface RecordRegistrationsInput {
  stationId: string;
  deviceId: string;
  groupId: string | null;
  records: { clientId: string; category: RegCategory }[];
}

/**
 * Stores 1..n visitors. Idempotent per clientId (architecture D3): a retried request
 * inserts nothing new, so taps are never doubled (FR-REG-5/6, NFR-R-1).
 */
export async function recordRegistrations(
  { db, clock }: AppDeps,
  user: CurrentUser,
  input: RecordRegistrationsInput,
): Promise<CreateCountsResponse> {
  await getStationOfKind(db, input.stationId, ['registration'], { forWriting: true });
  const recordedAt = clock.now();
  const inserted = await db
    .insert(registration)
    .values(
      input.records.map((r) => ({
        clientId: r.clientId,
        stationId: input.stationId,
        category: r.category,
        groupId: input.groupId,
        recordedBy: user.id,
        deviceId: input.deviceId,
        recordedAt,
      })),
    )
    .onConflictDoNothing({ target: registration.clientId })
    .returning({ id: registration.id });
  return { saved: inserted.length };
}

/**
 * Undo within the window by the same user (FR-REG-3). Undoing any member of a family
 * removes the whole family, because the family was recorded as one action.
 */
export async function undoRegistration(
  { db, clock }: AppDeps,
  user: CurrentUser,
  clientId: string,
): Promise<{ removed: number }> {
  const [row] = await db
    .select()
    .from(registration)
    .where(and(eq(registration.clientId, clientId), isNull(registration.voidedAt)));
  if (!row) throw notFound('Record');
  assertUndoable(row, user, clock.now());

  const match = row.groupId
    ? and(eq(registration.groupId, row.groupId), eq(registration.recordedBy, user.id))
    : eq(registration.clientId, clientId);
  const removed = await db.delete(registration).where(match).returning({ id: registration.id });
  return { removed: removed.length };
}

/** Today's (SGT) registrations at one station, in total, per category and for one device. */
export async function registrationSummary(
  { db, clock }: AppDeps,
  query: SummaryQuery,
): Promise<RegistrationSummary> {
  await getStationOfKind(db, query.stationId, ['registration'], { forWriting: false });
  const { date, start, end } = sgtDayBounds(clock.now());
  const rows = await db
    .select({
      category: registration.category,
      total: sql<number>`count(*)::int`,
      device: sql<number>`(count(*) filter (where ${registration.deviceId} = ${query.deviceId ?? ''}))::int`,
    })
    .from(registration)
    .where(
      and(
        eq(registration.stationId, query.stationId),
        gte(registration.recordedAt, start),
        lt(registration.recordedAt, end),
        isNull(registration.voidedAt),
      ),
    )
    .groupBy(registration.category);

  const byCategory = Object.fromEntries(REG_CATEGORIES.map((c) => [c, 0])) as Record<
    RegCategory,
    number
  >;
  let total = 0;
  let device = 0;
  for (const r of rows) {
    byCategory[r.category] = r.total;
    total += r.total;
    device += r.device;
  }
  return { stationId: query.stationId, date, total, device, byCategory };
}
