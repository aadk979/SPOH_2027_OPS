import { asc } from 'drizzle-orm';
import type { Rank } from '@spoh/shared';
import type { Db } from '../../src/db/client.js';
import { eventDay, person } from '../../src/db/schema/index.js';
import type { TestContext, TestPerson } from './test-app.js';

/** Seeded event-day IDs by date, e.g. days['2027-01-07']. */
export async function seededDays(db: Db): Promise<Record<string, string>> {
  const rows = await db.select().from(eventDay).orderBy(asc(eventDay.date));
  return Object.fromEntries(rows.map((d) => [d.date, d.id]));
}

let counter = 0;

/** A roster person who is not signed in (fictional name). */
export async function addPerson(
  db: Db,
  options: { rank?: Rank; team?: string | null; days?: string[]; name?: string } = {},
): Promise<string> {
  counter += 1;
  const rank = options.rank ?? 'volunteer';
  const [row] = await db
    .insert(person)
    .values({
      name: options.name ?? `Test Person ${counter}`,
      email: `person${counter}.${Date.now()}@ichat.sp.edu.sg`,
      rank,
      team: options.team === undefined ? 'Room Ushers' : options.team,
      availableDayIds: options.days ?? [],
    })
    .returning();
  return row!.id;
}

export function assignAs(
  ctx: TestContext,
  user: TestPerson,
  body: {
    personIds: string[];
    stationId: string;
    dayIds: string[];
    from?: string;
    override?: boolean;
  },
) {
  return ctx.as(user, {
    method: 'POST',
    url: '/api/deployment/assign',
    payload: { from: 'now', ...body },
  });
}
