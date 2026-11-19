import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { footfall } from '../../db/schema/index.js';
import { createTestApp, type TestContext } from '../../../test/helpers/test-app.js';
import { deviceId, getSummary, postFootfall, stationId } from '../../../test/helpers/counting.js';

describe('footfall API', () => {
  let ctx: TestContext;
  let lounge: string;
  let counselling: string;
  beforeEach(async () => {
    ctx = await createTestApp();
    lounge = await stationId(ctx.db, 'Welcome Lounge');
    counselling = await stationId(ctx.db, 'Counselling Room');
  });
  afterEach(() => ctx.close());

  const entry = (count = 1) => ({ clientId: randomUUID(), variant: 'entry', count });

  it('FR-FOOT-1: +1 and +n taps add up to people counted', async () => {
    const vol = await ctx.signIn('volunteer');
    const dev = deviceId();
    for (let i = 0; i < 5; i += 1) {
      await postFootfall(ctx, vol, { stationId: lounge, deviceId: dev, records: [entry()] });
    }
    await postFootfall(ctx, vol, { stationId: lounge, deviceId: dev, records: [entry(3)] });
    const summary = (await getSummary(ctx, vol, 'footfall', lounge, dev)).json();
    expect(summary).toMatchObject({ total: 8, device: 8, byVariant: { entry: 8 } });
  });

  it('is idempotent per clientId (FR-FOOT-5)', async () => {
    const vol = await ctx.signIn('volunteer');
    const body = { stationId: lounge, deviceId: deviceId(), records: [entry(4)] };
    expect((await postFootfall(ctx, vol, body)).json().saved).toBe(1);
    expect((await postFootfall(ctx, vol, body)).json().saved).toBe(0);
    expect((await getSummary(ctx, vol, 'footfall', lounge)).json().total).toBe(4);
  });

  it('rejects +0 and groups over 100', async () => {
    const vol = await ctx.signIn('volunteer');
    for (const count of [0, 101]) {
      const res = await postFootfall(ctx, vol, {
        stationId: lounge,
        deviceId: deviceId(),
        records: [entry(count)],
      });
      expect(res.statusCode).toBe(400);
    }
  });

  describe('Counselling Room (FR-FOOT-3/4)', () => {
    it('splits guided and walk-in, with an optional course tag', async () => {
      const vol = await ctx.signIn('volunteer');
      const dev = deviceId();
      const res = await postFootfall(ctx, vol, {
        stationId: counselling,
        deviceId: dev,
        records: [
          { clientId: randomUUID(), variant: 'guided', count: 12 },
          { clientId: randomUUID(), variant: 'walk_in', course: 'DAAA' },
          { clientId: randomUUID(), variant: 'walk_in' },
        ],
      });
      expect(res.json().saved).toBe(3);
      const summary = (await getSummary(ctx, vol, 'footfall', counselling, dev)).json();
      expect(summary).toMatchObject({ total: 14, byVariant: { guided: 12, walk_in: 2, entry: 0 } });
      const courses = (await ctx.db.select().from(footfall)).map((r) => r.course).sort();
      expect(courses).toEqual(['DAAA', null, null]);
    });

    it('does not accept plain entries, and other rooms do not accept guided/walk-in', async () => {
      const vol = await ctx.signIn('volunteer');
      const plain = await postFootfall(ctx, vol, {
        stationId: counselling,
        deviceId: deviceId(),
        records: [entry()],
      });
      expect(plain.statusCode).toBe(400);
      const guided = await postFootfall(ctx, vol, {
        stationId: lounge,
        deviceId: deviceId(),
        records: [{ clientId: randomUUID(), variant: 'guided' }],
      });
      expect(guided.statusCode).toBe(400);
      expect(await ctx.db.select().from(footfall)).toHaveLength(0);
    });

    it('only tags courses in the Counselling Room, and only DAAA / DCDF / DCS', async () => {
      const vol = await ctx.signIn('volunteer');
      const tagged = await postFootfall(ctx, vol, {
        stationId: lounge,
        deviceId: deviceId(),
        records: [{ ...entry(), course: 'DCS' }],
      });
      expect(tagged.statusCode).toBe(400);
      const otherCourse = await postFootfall(ctx, vol, {
        stationId: counselling,
        deviceId: deviceId(),
        records: [{ clientId: randomUUID(), variant: 'walk_in', course: 'DCITP' }],
      });
      expect(otherCourse.statusCode).toBe(400);
    });
  });

  it('rejects the Sign-Up Booth (registration is never counted as footfall)', async () => {
    const vol = await ctx.signIn('volunteer');
    const booth = await stationId(ctx.db, 'Sign-Up Booth');
    const res = await postFootfall(ctx, vol, {
      stationId: booth,
      deviceId: deviceId(),
      records: [entry()],
    });
    expect(res.statusCode).toBe(400);
    expect((await getSummary(ctx, vol, 'footfall', booth)).statusCode).toBe(400);
  });

  describe('T-03: undo', () => {
    it('removes a +n tap within 10 s', async () => {
      const vol = await ctx.signIn('volunteer');
      const tap = entry(5);
      await postFootfall(ctx, vol, { stationId: lounge, deviceId: deviceId(), records: [tap] });
      ctx.clock.advance(10_000);
      const res = await ctx.as(vol, { method: 'DELETE', url: `/api/footfall/${tap.clientId}` });
      expect(res.json().removed).toBe(1);
      expect((await getSummary(ctx, vol, 'footfall', lounge)).json().total).toBe(0);
    });

    it("rejects late undo and someone else's undo", async () => {
      const vol = await ctx.signIn('volunteer');
      const other = await ctx.signIn('volunteer');
      const tap = entry();
      await postFootfall(ctx, vol, { stationId: lounge, deviceId: deviceId(), records: [tap] });
      const url = `/api/footfall/${tap.clientId}`;
      expect((await ctx.as(other, { method: 'DELETE', url })).statusCode).toBe(403);
      ctx.clock.advance(10_500);
      expect((await ctx.as(vol, { method: 'DELETE', url })).statusCode).toBe(409);
      expect(await ctx.db.select().from(footfall)).toHaveLength(1);
    });
  });
});
