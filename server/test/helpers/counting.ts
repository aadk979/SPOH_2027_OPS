import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { RegCategory } from '@spoh/shared';
import type { Db } from '../../src/db/client.js';
import { station } from '../../src/db/schema/index.js';
import type { TestContext, TestPerson } from './test-app.js';

/** ID of a seeded station by its name, e.g. "Sign-Up Booth". */
export async function stationId(db: Db, name: string): Promise<string> {
  const [row] = await db.select({ id: station.id }).from(station).where(eq(station.name, name));
  if (!row) throw new Error(`No seeded station called ${name}`);
  return row.id;
}

export const deviceId = () => `dev-${randomUUID()}`;

/** POST /api/registrations with one record per category given. */
export function postRegistrations(
  ctx: TestContext,
  user: TestPerson,
  body: {
    stationId: string;
    deviceId: string;
    groupId?: string | null;
    records: { clientId: string; category: RegCategory }[];
  },
) {
  return ctx.as(user, { method: 'POST', url: '/api/registrations', payload: body });
}

export function postFootfall(
  ctx: TestContext,
  user: TestPerson,
  body: {
    stationId: string;
    deviceId: string;
    records: { clientId: string; variant: string; count?: number; course?: string | null }[];
  },
) {
  return ctx.as(user, { method: 'POST', url: '/api/footfall', payload: body });
}

export function getSummary(
  ctx: TestContext,
  user: TestPerson,
  kind: 'registrations' | 'footfall',
  stationIdValue: string,
  device?: string,
) {
  const query = new URLSearchParams({ stationId: stationIdValue });
  if (device) query.set('deviceId', device);
  return ctx.as(user, { method: 'GET', url: `/api/${kind}/summary?${query}` });
}
