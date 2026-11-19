import { asc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { appConfig, eventDay } from '../../db/schema/index.js';

/** Reads the single settings row (seeded on start-up). */
export async function getAppConfig(db: Db) {
  const [row] = await db.select().from(appConfig).where(eq(appConfig.id, 1));
  if (!row) throw new Error('app_config row missing — seedDefaults() has not run.');
  return row;
}

/** Event days in date order. */
export async function listEventDays(db: Db) {
  return db.select().from(eventDay).orderBy(asc(eventDay.date));
}
