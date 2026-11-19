import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { breakPeriod, dutyChange } from '../../db/schema/index.js';
import {
  createTestApp,
  type TestContext,
  type TestPerson,
} from '../../../test/helpers/test-app.js';
import { stationId } from '../../../test/helpers/counting.js';
import { addPerson, assignAs, seededDays } from '../../../test/helpers/deployment.js';

describe('My Duty, Got it and the team view', () => {
  let ctx: TestContext;
  let admin: TestPerson;
  let days: Record<string, string>;
  let lounge: string;
  let counsel: string;
  const thu = () => days['2027-01-07']!;

  beforeEach(async () => {
    ctx = await createTestApp(); // clock: Thu 7 Jan 2027, 10:00 SGT
    admin = await ctx.signIn('deputy', { name: 'Dana Deputy' });
    days = await seededDays(ctx.db);
    lounge = await stationId(ctx.db, 'Welcome Lounge');
    counsel = await stationId(ctx.db, 'Counselling Room');
  });
  afterEach(() => ctx.close());

  const duty = async (user: TestPerson) =>
    (await ctx.as(user, { method: 'GET', url: '/api/duty/me' })).json();

  it("shows today's post, IC, times, breaks, later moves and pending changes (FR-DUTY-5)", async () => {
    await ctx.as(admin, {
      method: 'PATCH',
      url: `/api/days/${thu()}`,
      payload: { reportTime: '09:00', dismissTime: '18:00' },
    });
    await addPerson(ctx.db, { rank: 'ic', team: 'Room Ushers', name: 'Casey Ong' });
    const vol = await ctx.signIn('volunteer', { team: 'Room Ushers', availableDayIds: [thu()] });
    await assignAs(ctx, admin, { personIds: [vol.id], stationId: lounge, dayIds: [thu()] });
    await assignAs(ctx, admin, {
      personIds: [vol.id],
      stationId: counsel,
      dayIds: [thu()],
      from: '13:00',
    });
    await ctx.db.insert(breakPeriod).values({
      personId: vol.id,
      dayId: thu(),
      startsAt: new Date('2027-01-07T04:00:00Z'),
      endsAt: new Date('2027-01-07T04:45:00Z'),
      label: 'Lunch',
    });

    const body = await duty(vol);
    expect(body.team).toBe('Room Ushers');
    expect(body.icNames).toEqual(['Casey Ong']);
    expect(body.todayDayId).toBe(thu());
    expect(body.defaultDayId).toBe(thu());
    const today = body.days.find((d: { day: { id: string } }) => d.day.id === thu());
    expect(today).toMatchObject({
      available: true,
      day: { reportTime: '09:00', dismissTime: '18:00' },
      station: { name: 'Welcome Lounge', room: 'T2036' },
      later: [{ from: '13:00', station: { name: 'Counselling Room' } }],
      breaks: [{ start: '12:00', end: '12:45', label: 'Lunch' }],
    });
    expect(body.pending.map((p: { summary: string }) => p.summary)).toEqual([
      'Thu 7 Jan: Welcome Lounge → Counselling Room from 13:00',
      'Thu 7 Jan: Welcome Lounge from 10:00',
    ]);
    expect(body.pending[0].createdBy).toBe('Dana Deputy');
  });

  it('opens on the next event day when today is not one (C-7)', async () => {
    ctx.clock.set('2026-12-12T02:00:00Z');
    const vol = await ctx.signIn('volunteer');
    const body = await duty(vol);
    expect(body.todayDayId).toBeNull();
    expect(body.defaultDayId).toBe(days['2027-01-06']);
  });

  it('Got it acknowledges only your own changes and stores the time (FR-DUTY-7)', async () => {
    const vol = await ctx.signIn('volunteer', { availableDayIds: [thu()] });
    const other = await addPerson(ctx.db, { days: [thu()] });
    await assignAs(ctx, admin, { personIds: [vol.id, other], stationId: lounge, dayIds: [thu()] });
    const all = await ctx.db.select().from(dutyChange);
    const ack = await ctx.as(vol, {
      method: 'POST',
      url: '/api/duty/ack',
      payload: { ids: all.map((c) => c.id) },
    });
    expect(ack.json()).toEqual({ acknowledged: 1 });
    const [mine] = await ctx.db.select().from(dutyChange).where(eq(dutyChange.personId, vol.id));
    expect(mine!.acknowledgedAt).toEqual(ctx.clock.now());
    const [theirs] = await ctx.db.select().from(dutyChange).where(eq(dutyChange.personId, other));
    expect(theirs!.acknowledgedAt).toBeNull();
    expect((await duty(vol)).pending).toEqual([]);

    const unacked = await ctx.as(admin, { method: 'GET', url: '/api/deployment/unacked' });
    expect(unacked.json().changes.map((c: { personId: string }) => c.personId)).toEqual([other]);
  });

  it("FR-DUTY-10: an IC sees their own team's contacts and posts", async () => {
    const ic = await ctx.signIn('ic', { team: 'Room Ushers' });
    const mate = await addPerson(ctx.db, { team: 'Room Ushers', days: [thu()], name: 'Alex Tan' });
    await addPerson(ctx.db, { team: 'Guides', days: [thu()], name: 'Not Mine' });
    await assignAs(ctx, admin, { personIds: [mate], stationId: lounge, dayIds: [thu()] });

    const res = await ctx.as(ic, { method: 'GET', url: '/api/team' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.team).toBe('Room Ushers');
    expect(body.day.id).toBe(thu());
    const names = body.members.map((m: { name: string }) => m.name);
    expect(names).toContain('Alex Tan');
    expect(names).not.toContain('Not Mine');
    const alex = body.members.find((m: { name: string }) => m.name === 'Alex Tan');
    expect(alex).toMatchObject({ station: { name: 'Welcome Lounge' }, unacked: 1 });
    expect(alex.email).toMatch(/@ichat\.sp\.edu\.sg$/);
  });

  it("T-09: a volunteer cannot see other people's contact details", async () => {
    const vol = await ctx.signIn('volunteer', { team: 'Room Ushers' });
    await addPerson(ctx.db, { team: 'Room Ushers' });
    expect((await ctx.as(vol, { method: 'GET', url: '/api/team' })).statusCode).toBe(403);
    expect((await ctx.as(vol, { method: 'GET', url: '/api/people' })).statusCode).toBe(403);
    expect(JSON.stringify(await duty(vol))).not.toMatch(/@ichat/);
  });
});
