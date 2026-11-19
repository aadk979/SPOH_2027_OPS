import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import {
  FOOTFALL_VARIANTS,
  FOOTFALL_VARIANT_LABELS,
  FOOTFALL_VARIANTS_FOR_KIND,
  sgtDayBounds,
  type CounsellingCourse,
  type CreateCountsResponse,
  type CurrentUser,
  type FootfallSummary,
  type FootfallVariant,
  type SummaryQuery,
} from '@spoh/shared';
import type { AppDeps } from '../../deps.js';
import { footfall } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { assertUndoable } from '../../lib/undo.js';
import { getStationOfKind } from '../stations/stations.service.js';

/*
 * Footfall = people entering a counting point; one row per tap, `count` people (FR-FOOT-*).
 * RULE 1: nothing here reads or returns registrations. RULE 2: no visitor data is stored.
 */

const FOOTFALL_KINDS = ['counting', 'counselling'] as const;

export interface RecordFootfallInput {
  stationId: string;
  deviceId: string;
  records: {
    clientId: string;
    variant: FootfallVariant;
    count: number;
    course: CounsellingCourse | null;
  }[];
}

/** Counting points take plain entries; the Counselling Room takes guided / walk-in (FR-FOOT-3). */
function checkRecordsFitStation(
  kind: (typeof FOOTFALL_KINDS)[number],
  stationName: string,
  records: RecordFootfallInput['records'],
) {
  const allowed = FOOTFALL_VARIANTS_FOR_KIND[kind] ?? [];
  const wrong = records.find((r) => !allowed.includes(r.variant));
  if (wrong) {
    const options = allowed.map((v) => FOOTFALL_VARIANT_LABELS[v]).join(' or ');
    throw badRequest(`${stationName} counts ${options}.`);
  }
  if (kind !== 'counselling' && records.some((r) => r.course !== null)) {
    throw badRequest('A course can only be tagged in the Counselling Room.');
  }
}

/** Stores 1..n taps, idempotent per clientId (FR-FOOT-5, architecture D3). */
export async function recordFootfall(
  { db, clock }: AppDeps,
  user: CurrentUser,
  input: RecordFootfallInput,
): Promise<CreateCountsResponse> {
  const st = await getStationOfKind(db, input.stationId, FOOTFALL_KINDS, { forWriting: true });
  checkRecordsFitStation(st.kind as (typeof FOOTFALL_KINDS)[number], st.name, input.records);
  const recordedAt = clock.now();
  const inserted = await db
    .insert(footfall)
    .values(
      input.records.map((r) => ({
        clientId: r.clientId,
        stationId: input.stationId,
        variant: r.variant,
        count: r.count,
        course: r.course,
        recordedBy: user.id,
        deviceId: input.deviceId,
        recordedAt,
      })),
    )
    .onConflictDoNothing({ target: footfall.clientId })
    .returning({ id: footfall.id });
  return { saved: inserted.length };
}

/** Undo one tap (a "+n" tap is one record) within the window, by the same user. */
export async function undoFootfall(
  { db, clock }: AppDeps,
  user: CurrentUser,
  clientId: string,
): Promise<{ removed: number }> {
  const [row] = await db
    .select()
    .from(footfall)
    .where(and(eq(footfall.clientId, clientId), isNull(footfall.voidedAt)));
  if (!row) throw notFound('Record');
  assertUndoable(row, user, clock.now());
  const removed = await db
    .delete(footfall)
    .where(eq(footfall.clientId, clientId))
    .returning({ id: footfall.id });
  return { removed: removed.length };
}

/** Today's (SGT) people counted at one station, in total, per variant and for one device. */
export async function footfallSummary(
  { db, clock }: AppDeps,
  query: SummaryQuery,
): Promise<FootfallSummary> {
  await getStationOfKind(db, query.stationId, FOOTFALL_KINDS, { forWriting: false });
  const { date, start, end } = sgtDayBounds(clock.now());
  const rows = await db
    .select({
      variant: footfall.variant,
      total: sql<number>`coalesce(sum(${footfall.count}), 0)::int`,
      device: sql<number>`coalesce(sum(${footfall.count}) filter (where ${footfall.deviceId} = ${query.deviceId ?? ''}), 0)::int`,
    })
    .from(footfall)
    .where(
      and(
        eq(footfall.stationId, query.stationId),
        gte(footfall.recordedAt, start),
        lt(footfall.recordedAt, end),
        isNull(footfall.voidedAt),
      ),
    )
    .groupBy(footfall.variant);

  const byVariant = Object.fromEntries(FOOTFALL_VARIANTS.map((v) => [v, 0])) as Record<
    FootfallVariant,
    number
  >;
  let total = 0;
  let device = 0;
  for (const r of rows) {
    byVariant[r.variant] = r.total;
    total += r.total;
    device += r.device;
  }
  return { stationId: query.stationId, date, total, device, byVariant };
}
