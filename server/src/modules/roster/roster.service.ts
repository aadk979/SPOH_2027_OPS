import { eq, inArray } from 'drizzle-orm';
import type { RosterCommitResponse, RosterPreviewResponse, RosterRowStatus } from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { person } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { getAppConfig, listEventDays } from '../config/app-config.js';
import { parseRosterCsv, templateColumns, type ParsedRosterRow } from './roster.parse.js';

type PersonRow = typeof person.$inferSelect;

const COMPARED_FIELDS = ['name', 'phone', 'course', 'rank', 'team', 'portfolio'] as const;

function statusOf(incoming: ParsedRosterRow, existing: PersonRow | undefined): RosterRowStatus {
  if (!existing) return 'new';
  const sameDays =
    [...incoming.availableDayIds].sort().join() === [...existing.availableDayIds].sort().join();
  const sameFields = COMPARED_FIELDS.every((f) => (incoming[f] ?? null) === (existing[f] ?? null));
  return sameDays && sameFields && existing.active ? 'unchanged' : 'updated';
}

async function analyse(db: Db, csv: string) {
  const [config, days] = await Promise.all([getAppConfig(db), listEventDays(db)]);
  const parsed = parseRosterCsv(csv, { teams: config.teams, portfolios: config.portfolios, days });
  const existing = await db.select().from(person);
  const byEmail = new Map(existing.map((p) => [p.email, p]));
  const rows = parsed.people.map((p) => ({
    ...p,
    status: statusOf(p, byEmail.get(p.email)),
    existing: byEmail.get(p.email),
  }));
  const inFile = new Set(parsed.people.map((p) => p.email));
  const missing = existing.filter((p) => p.active && !inFile.has(p.email));
  return { parsed, rows, missing };
}

/**
 * Validates the whole file and shows what *would* happen; saves nothing (FR-CFG-2).
 * The importing CC is never listed as "missing" (they can't deactivate themselves).
 */
export async function previewRoster(
  db: Db,
  csv: string,
  actorId: string,
): Promise<RosterPreviewResponse> {
  const { parsed, rows, missing: allMissing } = await analyse(db, csv);
  const missing = allMissing.filter((p) => p.id !== actorId);
  const count = (s: RosterRowStatus) => rows.filter((r) => r.status === s).length;
  return {
    summary: {
      new: count('new'),
      updated: count('updated'),
      unchanged: count('unchanged'),
      errors: parsed.errors.length,
    },
    rows: rows.map((r) => ({ row: r.row, name: r.name, email: r.email, status: r.status })),
    errors: parsed.errors,
    missing: missing.map((p) => ({ id: p.id, name: p.name, email: p.email })),
  };
}

/**
 * All-or-nothing import: re-validates, then upserts every row by email in one transaction.
 * Anyone not in the file is left untouched (FR-CFG-3).
 */
export async function commitRoster(
  db: Db,
  actorId: string,
  csv: string,
): Promise<RosterCommitResponse> {
  const { parsed, rows } = await analyse(db, csv);
  if (parsed.errors.length > 0) {
    throw new AppError(
      400,
      'ROSTER_INVALID',
      'The file has errors. Nothing was saved.',
      parsed.errors,
    );
  }
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const r of rows) {
      if (r.status === 'unchanged') continue;
      const values = {
        name: r.name,
        email: r.email,
        phone: r.phone,
        course: r.course,
        rank: r.rank,
        team: r.team,
        portfolio: r.portfolio,
        availableDayIds: r.availableDayIds,
        active: true,
      };
      if (r.existing)
        await tx
          .update(person)
          .set({ ...values, updatedAt: now })
          .where(eq(person.id, r.existing.id));
      else await tx.insert(person).values(values);
    }
  });
  const result = {
    created: rows.filter((r) => r.status === 'new').length,
    updated: rows.filter((r) => r.status === 'updated').length,
    unchanged: rows.filter((r) => r.status === 'unchanged').length,
  };
  await audit(db, { actorId, action: 'roster.commit', details: result });
  return result;
}

/** Header-only CSV whose day columns match the currently configured event days. */
export async function rosterTemplate(db: Db): Promise<string> {
  return `${templateColumns(await listEventDays(db)).join(',')}\n`;
}

/** Deactivates the given people (used for "missing from file" after a re-import). */
export async function deactivatePeople(db: Db, actorId: string, ids: string[]) {
  const safeIds = ids.filter((id) => id !== actorId);
  if (safeIds.length === 0) return 0;
  const updated = await db
    .update(person)
    .set({ active: false })
    .where(inArray(person.id, safeIds))
    .returning({ id: person.id });
  await audit(db, { actorId, action: 'roster.deactivate', details: { count: updated.length } });
  return updated.length;
}
