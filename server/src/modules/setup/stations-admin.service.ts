import { asc, eq } from 'drizzle-orm';
import type {
  CurrentUser,
  StationAdminDto,
  StationInput,
  StationPatch,
  Thresholds,
} from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { appConfig, station } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { getAppConfig } from '../config/app-config.js';
import { getStation, toStationDto } from '../stations/stations.service.js';

type StationRow = typeof station.$inferSelect;

function toAdminDto(s: StationRow): StationAdminDto {
  return { ...toStationDto(s), capacity: s.capacity, active: s.active };
}

/** All stations, including closed ones, for Setup (FR-CFG-6). */
export async function listAllStations(db: Db): Promise<StationAdminDto[]> {
  const rows = await db.select().from(station).orderBy(asc(station.sortOrder), asc(station.name));
  return rows.map(toAdminDto);
}

async function assertNameFree(db: Db, name: string, exceptId?: string) {
  const [clash] = await db.select({ id: station.id }).from(station).where(eq(station.name, name));
  if (clash && clash.id !== exceptId) throw conflict(`There is already a station called ${name}.`);
}

async function assertTeam(db: Db, team: string | null | undefined) {
  if (!team) return;
  const { teams } = await getAppConfig(db);
  if (!teams.includes(team)) throw badRequest(`${team} is not one of the configured teams.`);
}

/** A new station is usable straight away on every screen (FR-CFG-6 AC). */
export async function createStation(db: Db, actor: CurrentUser, input: StationInput) {
  await assertNameFree(db, input.name);
  await assertTeam(db, input.team);
  const [created] = await db.insert(station).values(input).returning();
  await audit(db, { actorId: actor.id, action: 'station.create', target: created!.id });
  return toAdminDto(created!);
}

/**
 * Edits a station. Stations are closed (active=false), never deleted, so their counts
 * and history stay intact.
 */
export async function updateStation(db: Db, actor: CurrentUser, id: string, patch: StationPatch) {
  await getStation(db, id);
  if (patch.name) await assertNameFree(db, patch.name, id);
  await assertTeam(db, patch.team);
  const [updated] = await db.update(station).set(patch).where(eq(station.id, id)).returning();
  await audit(db, {
    actorId: actor.id,
    action: 'station.update',
    target: id,
    details: { fields: Object.keys(patch) },
  });
  return toAdminDto(updated!);
}

export async function getThresholds(db: Db): Promise<Thresholds> {
  const c = await getAppConfig(db);
  return {
    busyWindowMin: c.busyWindowMin,
    busyPct: c.busyPct,
    quietPct: c.quietPct,
    lowStockPct: c.lowStockPct,
  };
}

/** Busy/quiet window and thresholds, and the low-stock percentage (FR-DASH-3, FR-GIFT-3). */
export async function saveThresholds(db: Db, actor: CurrentUser, input: Thresholds) {
  await db
    .update(appConfig)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(appConfig.id, 1));
  await audit(db, { actorId: actor.id, action: 'config.thresholds', details: { ...input } });
  return getThresholds(db);
}
