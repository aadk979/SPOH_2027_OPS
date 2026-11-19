import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REG_CATEGORIES } from '@spoh/shared';
import { createTestApp, type TestContext, type TestPerson } from './helpers/test-app.js';
import {
  deviceId,
  getSummary,
  postFootfall,
  postRegistrations,
  stationId,
} from './helpers/counting.js';

/*
 * Rules that span both kinds of count. T-02 runs on in-memory PGlite (one connection, so
 * requests interleave at the app level). To repeat it on real Postgres with a connection
 * pool, run `npm run load:counting -w server` against a running server (see that script).
 */

const CLIENTS = 5;
const TAPS_PER_CLIENT = 120;

/** Fires `taps` taps from one client, 4 in flight at a time, re-sending every 10th (a retry). */
async function tapAway(taps: number, send: (clientId: string) => Promise<number>) {
  const ids = Array.from({ length: taps }, () => randomUUID());
  const queue = [...ids, ...ids.filter((_, i) => i % 10 === 0)];
  const workers = Array.from({ length: 4 }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const status = await send(id);
      if (status !== 200) throw new Error(`tap failed with ${status}`);
    }
  });
  await Promise.all(workers);
}

/** Every numeric value anywhere in a JSON payload. */
function numbersIn(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(numbersIn);
  return [];
}

describe('counting rules', () => {
  let ctx: TestContext;
  let clients: { user: TestPerson; device: string }[];
  beforeEach(async () => {
    ctx = await createTestApp();
    clients = [];
    for (let i = 0; i < CLIENTS; i += 1) {
      clients.push({ user: await ctx.signIn('volunteer'), device: deviceId() });
    }
  });
  afterEach(() => ctx.close());

  it('T-02: 5 parallel clients x 120 registration taps (with retries) give exactly 600', async () => {
    const booth = await stationId(ctx.db, 'Sign-Up Booth');
    await Promise.all(
      clients.map(({ user, device }, n) =>
        tapAway(TAPS_PER_CLIENT, async (clientId) => {
          const category = REG_CATEGORIES[n % REG_CATEGORIES.length]!;
          const res = await postRegistrations(ctx, user, {
            stationId: booth,
            deviceId: device,
            records: [{ clientId, category }],
          });
          return res.statusCode;
        }),
      ),
    );
    const summary = (await getSummary(ctx, clients[0]!.user, 'registrations', booth)).json();
    expect(summary.total).toBe(CLIENTS * TAPS_PER_CLIENT);
    const rows = await ctx.db.execute(sql`select count(*)::int as n from registration`);
    expect((rows as unknown as { rows: { n: number }[] }).rows[0]!.n).toBe(600);
  }, 60_000);

  it('T-02: the same holds for footfall taps', async () => {
    const lounge = await stationId(ctx.db, 'Welcome Lounge');
    await Promise.all(
      clients.map(({ user, device }) =>
        tapAway(TAPS_PER_CLIENT, async (clientId) => {
          const res = await postFootfall(ctx, user, {
            stationId: lounge,
            deviceId: device,
            records: [{ clientId, variant: 'entry' }],
          });
          return res.statusCode;
        }),
      ),
    );
    const summary = (await getSummary(ctx, clients[0]!.user, 'footfall', lounge)).json();
    expect(summary.total).toBe(600);
  }, 60_000);

  it('T-05: registration and footfall numbers never appear combined in any payload', async () => {
    const { user, device } = clients[0]!;
    const booth = await stationId(ctx.db, 'Sign-Up Booth');
    const lounge = await stationId(ctx.db, 'Welcome Lounge');
    const counselling = await stationId(ctx.db, 'Counselling Room');
    // Distinct totals so any sum would be detectable: 7 registrations, 5 + 9 people counted.
    await postRegistrations(ctx, user, {
      stationId: booth,
      deviceId: device,
      groupId: randomUUID(),
      records: Array.from({ length: 7 }, () => ({ clientId: randomUUID(), category: 'sec4' })),
    });
    await postFootfall(ctx, user, {
      stationId: lounge,
      deviceId: device,
      records: [{ clientId: randomUUID(), variant: 'entry', count: 5 }],
    });
    await postFootfall(ctx, user, {
      stationId: counselling,
      deviceId: device,
      records: [{ clientId: randomUUID(), variant: 'walk_in', count: 9 }],
    });

    const reg = (await getSummary(ctx, user, 'registrations', booth, device)).json();
    const foot = (await getSummary(ctx, user, 'footfall', lounge, device)).json();
    const room = (await getSummary(ctx, user, 'footfall', counselling, device)).json();
    expect(reg.total).toBe(7);
    expect(foot.total).toBe(5);
    expect(room.total).toBe(9);

    // Each summary carries only its own kind of field.
    expect(Object.keys(reg).sort()).toEqual(['byCategory', 'date', 'device', 'stationId', 'total']);
    expect(Object.keys(foot).sort()).toEqual(['byVariant', 'date', 'device', 'stationId', 'total']);

    // No payload anywhere holds a merged number (7+5, 7+9, 7+14).
    const stations = (await ctx.as(user, { method: 'GET', url: '/api/stations' })).json();
    const merged = [12, 16, 21];
    for (const payload of [reg, foot, room, stations]) {
      for (const m of merged) expect(numbersIn(payload)).not.toContain(m);
    }
  });
});
