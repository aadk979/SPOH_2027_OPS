import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RegCategory } from '@spoh/shared';
import { registration, station } from '../../db/schema/index.js';
import { createTestApp, type TestContext } from '../../../test/helpers/test-app.js';
import {
  deviceId,
  getSummary,
  postRegistrations,
  stationId,
} from '../../../test/helpers/counting.js';

describe('registration API', () => {
  let ctx: TestContext;
  let booth: string;
  beforeEach(async () => {
    ctx = await createTestApp();
    booth = await stationId(ctx.db, 'Sign-Up Booth');
  });
  afterEach(() => ctx.close());

  const one = (category: RegCategory = 'sec4') => ({ clientId: randomUUID(), category });

  it('T-01: the same clientId posted 3 times is stored once', async () => {
    const vol = await ctx.signIn('volunteer');
    const body = { stationId: booth, deviceId: deviceId(), records: [one()] };
    const saved = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await postRegistrations(ctx, vol, body);
      expect(res.statusCode).toBe(200);
      saved.push(res.json().saved);
    }
    expect(saved).toEqual([1, 0, 0]);
    expect(await ctx.db.select().from(registration)).toHaveLength(1);
  });

  it('stores category, station, user, device and time, and nothing about the visitor', async () => {
    const vol = await ctx.signIn('volunteer');
    const dev = deviceId();
    const rec = one('parent');
    await postRegistrations(ctx, vol, { stationId: booth, deviceId: dev, records: [rec] });
    const [row] = await ctx.db.select().from(registration);
    expect(row).toMatchObject({
      clientId: rec.clientId,
      category: 'parent',
      stationId: booth,
      recordedBy: vol.id,
      deviceId: dev,
      groupId: null,
      recordedAt: ctx.clock.now(),
    });
  });

  it('T-04: a family of 4 becomes 4 rows sharing one group_id', async () => {
    const vol = await ctx.signIn('volunteer');
    const groupId = randomUUID();
    const res = await postRegistrations(ctx, vol, {
      stationId: booth,
      deviceId: deviceId(),
      groupId,
      records: [one('sec4'), one('parent'), one('parent'), one('other')],
    });
    expect(res.json().saved).toBe(4);
    const rows = await ctx.db.select().from(registration);
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.groupId))).toEqual(new Set([groupId]));
  });

  describe('T-03: undo', () => {
    it('works within 10 s for the person who recorded it', async () => {
      const vol = await ctx.signIn('volunteer');
      const rec = one();
      await postRegistrations(ctx, vol, { stationId: booth, deviceId: deviceId(), records: [rec] });
      ctx.clock.advance(9_000);
      const res = await ctx.as(vol, {
        method: 'DELETE',
        url: `/api/registrations/${rec.clientId}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().removed).toBe(1);
      expect(await ctx.db.select().from(registration)).toHaveLength(0);
    });

    it('is rejected after 10 s', async () => {
      const vol = await ctx.signIn('volunteer');
      const rec = one();
      await postRegistrations(ctx, vol, { stationId: booth, deviceId: deviceId(), records: [rec] });
      ctx.clock.advance(10_001);
      const res = await ctx.as(vol, {
        method: 'DELETE',
        url: `/api/registrations/${rec.clientId}`,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('UNDO_EXPIRED');
      expect(await ctx.db.select().from(registration)).toHaveLength(1);
    });

    it("is rejected for someone else's tap, even an Admin's attempt", async () => {
      const vol = await ctx.signIn('volunteer');
      const deputy = await ctx.signIn('deputy');
      const rec = one();
      await postRegistrations(ctx, vol, { stationId: booth, deviceId: deviceId(), records: [rec] });
      const res = await ctx.as(deputy, {
        method: 'DELETE',
        url: `/api/registrations/${rec.clientId}`,
      });
      expect(res.statusCode).toBe(403);
      expect(await ctx.db.select().from(registration)).toHaveLength(1);
    });

    it('removes the whole family when any member is undone', async () => {
      const vol = await ctx.signIn('volunteer');
      const family = [one('sec3'), one('parent'), one('parent')];
      const single = one('sec1');
      const dev = deviceId();
      await postRegistrations(ctx, vol, { stationId: booth, deviceId: dev, records: [single] });
      await postRegistrations(ctx, vol, {
        stationId: booth,
        deviceId: dev,
        groupId: randomUUID(),
        records: family,
      });
      const res = await ctx.as(vol, {
        method: 'DELETE',
        url: `/api/registrations/${family[0]!.clientId}`,
      });
      expect(res.json().removed).toBe(3);
      const left = await ctx.db.select().from(registration);
      expect(left.map((r) => r.clientId)).toEqual([single.clientId]);
    });

    it('returns 404 for an unknown record', async () => {
      const vol = await ctx.signIn('volunteer');
      const res = await ctx.as(vol, {
        method: 'DELETE',
        url: `/api/registrations/${randomUUID()}`,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  it('rejects stations that are not registration points, and closed stations', async () => {
    const vol = await ctx.signIn('volunteer');
    const lounge = await stationId(ctx.db, 'Welcome Lounge');
    const wrong = await postRegistrations(ctx, vol, {
      stationId: lounge,
      deviceId: deviceId(),
      records: [one()],
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error.message).toMatch(/not a registration point/);

    await ctx.db.update(station).set({ active: false }).where(eq(station.id, booth));
    const closed = await postRegistrations(ctx, vol, {
      stationId: booth,
      deviceId: deviceId(),
      records: [one()],
    });
    expect(closed.statusCode).toBe(400);
    expect(await ctx.db.select().from(registration)).toHaveLength(0);
  });

  it('FR-REG-8: any station of kind "registration" can register visitors', async () => {
    const [extra] = await ctx.db
      .insert(station)
      .values({ name: 'Second Sign-Up Point', kind: 'registration' })
      .returning();
    const vol = await ctx.signIn('volunteer');
    const res = await postRegistrations(ctx, vol, {
      stationId: extra!.id,
      deviceId: deviceId(),
      records: [one()],
    });
    expect(res.json().saved).toBe(1);
  });

  it('rejects bad input and unsigned requests', async () => {
    const vol = await ctx.signIn('volunteer');
    const bad = await postRegistrations(ctx, vol, {
      stationId: booth,
      deviceId: deviceId(),
      records: [{ clientId: 'not-a-uuid', category: 'sec4' }],
    });
    expect(bad.statusCode).toBe(400);
    const anon = await ctx.as(null, {
      method: 'POST',
      url: '/api/registrations',
      payload: { stationId: booth, deviceId: deviceId(), records: [one()] },
    });
    expect(anon.statusCode).toBe(401);
  });

  it('FR-REG-4: summary shows today at this station, per category and for this device', async () => {
    const vol = await ctx.signIn('volunteer');
    const mine = deviceId();
    const other = deviceId();
    await postRegistrations(ctx, vol, {
      stationId: booth,
      deviceId: mine,
      records: [one('sec4'), one('sec4')],
    });
    await postRegistrations(ctx, vol, {
      stationId: booth,
      deviceId: other,
      records: [one('sec1')],
    });

    // Yesterday's taps are not "today".
    ctx.clock.advance(-24 * 3600_000);
    await postRegistrations(ctx, vol, { stationId: booth, deviceId: mine, records: [one('sec5')] });
    ctx.clock.advance(24 * 3600_000);

    const res = await getSummary(ctx, vol, 'registrations', booth, mine);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      date: '2027-01-07',
      total: 3,
      device: 2,
      byCategory: { sec4: 2, sec1: 1, sec5: 0, parent: 0 },
    });
  });

  it('T-14: works on any date, not only event days (C-7)', async () => {
    ctx.clock.set('2026-12-12T03:00:00Z');
    const vol = await ctx.signIn('volunteer');
    await postRegistrations(ctx, vol, { stationId: booth, deviceId: deviceId(), records: [one()] });
    const summary = (await getSummary(ctx, vol, 'registrations', booth)).json();
    expect(summary).toMatchObject({ date: '2026-12-12', total: 1, device: 0 });
  });
});
