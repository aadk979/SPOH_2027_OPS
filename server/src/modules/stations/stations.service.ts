import { asc, eq } from 'drizzle-orm';
import type { StationDto, StationKind } from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { station } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';

type StationRow = typeof station.$inferSelect;

export function toStationDto(s: StationRow): StationDto {
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    room: s.room,
    kind: s.kind,
    team: s.team,
    sortOrder: s.sortOrder,
  };
}

/** Active stations in display order (station picker). */
export async function listActiveStations(db: Db): Promise<StationDto[]> {
  const rows = await db
    .select()
    .from(station)
    .where(eq(station.active, true))
    .orderBy(asc(station.sortOrder), asc(station.name));
  return rows.map(toStationDto);
}

export async function getStation(db: Db, id: string): Promise<StationRow> {
  const [row] = await db.select().from(station).where(eq(station.id, id));
  if (!row) throw notFound('Station');
  return row;
}

const KIND_NAMES: Record<StationKind, string> = {
  staffed: 'a staffed-only station',
  registration: 'a registration point',
  counting: 'a counting point',
  counselling: 'the counselling room',
};

/**
 * Loads a station and checks it accepts this kind of record (FR-REG-8, FR-FOOT-1/3).
 * `forWriting` also requires it to be active: a deactivated station keeps its history
 * but takes no new counts.
 */
export async function getStationOfKind(
  db: Db,
  id: string,
  kinds: readonly StationKind[],
  options: { forWriting: boolean },
): Promise<StationRow> {
  const row = await getStation(db, id);
  if (options.forWriting && !row.active) {
    throw badRequest(`${row.name} is closed. Pick another station.`);
  }
  if (!kinds.includes(row.kind)) {
    const wanted = kinds.map((k) => KIND_NAMES[k]).join(' or ');
    throw badRequest(`${row.name} is ${KIND_NAMES[row.kind]}, not ${wanted}.`);
  }
  return row;
}
