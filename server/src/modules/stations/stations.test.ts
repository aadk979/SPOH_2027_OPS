import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { station } from '../../db/schema/index.js';
import { createTestApp, type TestContext } from '../../../test/helpers/test-app.js';

describe('stations API', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(() => ctx.close());

  it('requires sign-in', async () => {
    expect((await ctx.as(null, { method: 'GET', url: '/api/stations' })).statusCode).toBe(401);
  });

  it('lists active seeded stations in display order for any volunteer', async () => {
    const vol = await ctx.signIn('volunteer');
    const res = await ctx.as(vol, { method: 'GET', url: '/api/stations' });
    expect(res.statusCode).toBe(200);
    const stations = res.json().stations as { name: string; kind: string; room: string }[];
    expect(stations).toHaveLength(9);
    expect(stations[0]!.name).toBe('Bus Bay / Foyer');
    expect(stations.find((s) => s.name === 'Counselling Room')).toMatchObject({
      kind: 'counselling',
      room: 'T2135A/B',
    });
  });

  it('hides deactivated stations', async () => {
    await ctx.db.update(station).set({ active: false }).where(eq(station.name, 'School Talk'));
    const vol = await ctx.signIn('volunteer');
    const names = (await ctx.as(vol, { method: 'GET', url: '/api/stations' }))
      .json()
      .stations.map((s: { name: string }) => s.name);
    expect(names).not.toContain('School Talk');
  });
});
