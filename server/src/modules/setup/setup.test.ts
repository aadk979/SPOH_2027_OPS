import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assignment, dutyChange, eventDay, person, registration } from '../../db/schema/index.js';
import {
  createTestApp,
  type TestContext,
  type TestPerson,
} from '../../../test/helpers/test-app.js';
import { deviceId, postRegistrations, stationId } from '../../../test/helpers/counting.js';
import { addPerson, assignAs, seededDays } from '../../../test/helpers/deployment.js';

describe('setup API: days, stations, thresholds', () => {
  let ctx: TestContext;
  let admin: TestPerson;
  let days: Record<string, string>;
  beforeEach(async () => {
    ctx = await createTestApp();
    admin = await ctx.signIn('shadow_ic');
    days = await seededDays(ctx.db);
  });
  afterEach(() => ctx.close());

  const call = (
    method: 'POST' | 'PATCH' | 'PUT' | 'GET' | 'DELETE',
    url: string,
    payload?: object,
  ) => ctx.as(admin, { method, url, ...(payload ? { payload } : {}) });

  it('T-13: an added day appears in the days list and the CSV template, unavailable by default', async () => {
    const res = await call('POST', '/api/days', { date: '2027-01-10', label: 'Extra day' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ date: '2027-01-10', reportTime: null });
    const list = (await call('GET', '/api/days')).json().days;
    expect(list.map((d: { date: string }) => d.date)).toContain('2027-01-10');

    const cc = await ctx.signIn('cc');
    const csv = (await ctx.as(cc, { method: 'GET', url: '/api/roster/template.csv' })).body;
    expect(csv).toMatch(/2027-01-10/);
    const people = await ctx.db.select().from(person);
    expect(people.every((p) => !p.availableDayIds.includes(res.json().id))).toBe(true);

    expect((await call('POST', '/api/days', { date: '2027-01-10' })).statusCode).toBe(409);
  });

  it('a time change notifies everyone posted that day (FR-CFG-5b)', async () => {
    const thu = days['2027-01-07']!;
    const id = await addPerson(ctx.db, { days: [thu] });
    await assignAs(ctx, admin, {
      personIds: [id],
      stationId: await stationId(ctx.db, 'Welcome Lounge'),
      dayIds: [thu],
    });
    await ctx.db.delete(dutyChange);

    const res = await call('PATCH', `/api/days/${thu}`, { reportTime: '08:30' });
    expect(res.json()).toMatchObject({ reportTime: '08:30', dismissTime: null });
    const changes = await ctx.db.select().from(dutyChange);
    expect(changes).toMatchObject([
      { personId: id, kind: 'timing', summary: 'Thu 7 Jan: report not set → 08:30' },
    ]);

    await call('PATCH', `/api/days/${thu}`, { label: 'Renamed' });
    expect(await ctx.db.select().from(dutyChange)).toHaveLength(1); // label only: no change
    expect((await call('PATCH', `/api/days/${thu}`, { reportTime: '9am' })).statusCode).toBe(400);
  });

  it('T-13: removing a day with data needs confirmation and keeps counts (FR-CFG-5a)', async () => {
    const thu = days['2027-01-07']!;
    const id = await addPerson(ctx.db, { days: [thu] });
    const lounge = await stationId(ctx.db, 'Welcome Lounge');
    await assignAs(ctx, admin, { personIds: [id], stationId: lounge, dayIds: [thu] });
    const vol = await ctx.signIn('volunteer');
    await postRegistrations(ctx, vol, {
      stationId: await stationId(ctx.db, 'Sign-Up Booth'),
      deviceId: deviceId(),
      records: [{ clientId: randomUUID(), category: 'sec4' }],
    });

    const impact = (await call('GET', `/api/days/${thu}/impact`)).json();
    expect(impact).toEqual({
      assignments: 1,
      breaks: 0,
      dutyChanges: 1,
      availablePeople: 1,
      registrationsKept: 1,
      footfallKept: 0,
    });
    const blocked = await call('DELETE', `/api/days/${thu}`);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('CONFIRM_REQUIRED');

    expect((await call('DELETE', `/api/days/${thu}?confirm=true`)).statusCode).toBe(200);
    expect(await ctx.db.select().from(eventDay).where(eq(eventDay.id, thu))).toHaveLength(0);
    expect(await ctx.db.select().from(assignment)).toHaveLength(0);
    expect(await ctx.db.select().from(registration)).toHaveLength(1);
    const [p] = await ctx.db.select().from(person).where(eq(person.id, id));
    expect(p!.availableDayIds).toEqual([]);
  });

  it('removing an empty day needs no confirmation', async () => {
    const res = await call('DELETE', `/api/days/${days['2027-01-09']}`);
    expect(res.statusCode).toBe(200);
  });

  it('creates and edits stations; a new one is usable straight away (FR-CFG-6)', async () => {
    const res = await call('POST', '/api/setup/stations', {
      name: 'Robotics Demo',
      room: 'T2201',
      kind: 'counting',
      team: 'Room Ushers',
      capacity: 40,
    });
    expect(res.statusCode).toBe(201);
    const id = res.json().id as string;
    const vol = await ctx.signIn('volunteer');
    const picker = (await ctx.as(vol, { method: 'GET', url: '/api/stations' })).json().stations;
    expect(picker.map((s: { name: string }) => s.name)).toContain('Robotics Demo');

    expect(
      (await call('POST', '/api/setup/stations', { name: 'Robotics Demo', kind: 'staffed' }))
        .statusCode,
    ).toBe(409);
    expect(
      (await call('POST', '/api/setup/stations', { name: 'X', kind: 'staffed', team: 'Nope' }))
        .statusCode,
    ).toBe(400);

    const closed = await call('PATCH', `/api/setup/stations/${id}`, {
      active: false,
      capacity: null,
    });
    expect(closed.json()).toMatchObject({ active: false, capacity: null });
    const after = (await ctx.as(vol, { method: 'GET', url: '/api/stations' })).json().stations;
    expect(after.map((s: { name: string }) => s.name)).not.toContain('Robotics Demo');
    const all = (await call('GET', '/api/setup/stations')).json().stations;
    expect(all.find((s: { id: string }) => s.id === id)).toMatchObject({ active: false });
  });

  it('saves thresholds and rejects quiet >= busy', async () => {
    expect((await call('GET', '/api/setup/thresholds')).json()).toEqual({
      busyWindowMin: 30,
      busyPct: 80,
      quietPct: 20,
      lowStockPct: 10,
    });
    const ok = await call('PUT', '/api/setup/thresholds', {
      busyWindowMin: 20,
      busyPct: 75,
      quietPct: 25,
      lowStockPct: 15,
    });
    expect(ok.json()).toMatchObject({ busyWindowMin: 20, busyPct: 75 });
    const bad = await call('PUT', '/api/setup/thresholds', {
      busyWindowMin: 20,
      busyPct: 50,
      quietPct: 60,
      lowStockPct: 15,
    });
    expect(bad.statusCode).toBe(400);
  });

  it('only Admins can change setup', async () => {
    for (const rank of ['ic', 'volunteer'] as const) {
      const user = await ctx.signIn(rank);
      const res = await ctx.as(user, {
        method: 'POST',
        url: '/api/days',
        payload: { date: '2027-01-11' },
      });
      expect(res.statusCode).toBe(403);
      const put = await ctx.as(user, { method: 'GET', url: '/api/setup/stations' });
      expect(put.statusCode).toBe(403);
    }
    expect(await ctx.db.select().from(registration)).toHaveLength(0);
  });
});
