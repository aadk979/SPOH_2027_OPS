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

describe('breaks (FR-BRK-1..5)', () => {
  let ctx: TestContext;
  let admin: TestPerson;
  let thu: string;
  let lounge: string;
  let counsel: string;
  let amy: string;
  let ben: string;
  let cal: string;

  const breaks = (
    user: TestPerson,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) => ctx.as(user, { method, url: `/api/breaks${url}`, payload });
  const lunch = (extra: object = {}) => ({
    dayId: thu,
    start: '12:00',
    end: '12:45',
    label: 'Lunch',
    ...extra,
  });
  const changesFor = async (personId: string) =>
    (await ctx.db.select().from(dutyChange).where(eq(dutyChange.personId, personId)))
      .filter((c) => c.kind === 'break')
      .map((c) => c.summary);

  beforeEach(async () => {
    ctx = await createTestApp(); // Thu 7 Jan 2027, 10:00 SGT
    admin = await ctx.signIn('deputy');
    thu = (await seededDays(ctx.db))['2027-01-07']!;
    lounge = await stationId(ctx.db, 'Welcome Lounge');
    counsel = await stationId(ctx.db, 'Counselling Room');
    amy = await addPerson(ctx.db, { name: 'Amy Lim', team: 'Room Ushers', days: [thu] });
    ben = await addPerson(ctx.db, { name: 'Ben Koh', team: 'Room Ushers', days: [thu] });
    cal = await addPerson(ctx.db, { name: 'Cal Ng', team: 'Welfare', days: [thu] });
    await assignAs(ctx, admin, { personIds: [amy, ben], stationId: lounge, dayIds: [thu] });
    await assignAs(ctx, admin, { personIds: [cal], stationId: counsel, dayIds: [thu] });
  });
  afterEach(() => ctx.close());

  it('adds a slot by name, groups it, and tells each person (FR-BRK-1/2/3)', async () => {
    const res = await breaks(admin, 'POST', '', lunch({ personIds: [amy] }));
    expect(res.json()).toEqual({ added: 1, unchanged: 0 });
    const again = await breaks(admin, 'POST', '', lunch({ personIds: [amy] }));
    expect(again.json()).toEqual({ added: 0, unchanged: 1 });

    const list = await breaks(admin, 'GET', `?dayId=${thu}`);
    expect(list.json().slots).toEqual([
      {
        start: '12:00',
        end: '12:45',
        label: 'Lunch',
        people: [expect.objectContaining({ name: 'Amy Lim', stationName: 'Welcome Lounge' })],
      },
    ]);
    expect(await changesFor(amy)).toEqual(['Thu 7 Jan: Break 12:00–12:45 (Lunch) added']);
  });

  it('adds by team and by station', async () => {
    await breaks(admin, 'POST', '', lunch({ teams: ['Welfare'], override: true }));
    await breaks(admin, 'POST', '', {
      dayId: thu,
      start: '15:00',
      end: '15:15',
      stationIds: [lounge],
      override: true,
    });
    const slots = (await breaks(admin, 'GET', `?dayId=${thu}`)).json().slots;
    expect(slots.map((s: { people: { name: string }[] }) => s.people.map((p) => p.name))).toEqual([
      ['Cal Ng'],
      ['Amy Lim', 'Ben Koh'],
    ]);
  });

  it('warns when a station would be left with nobody, and allows it on override (FR-BRK-4)', async () => {
    await breaks(admin, 'POST', '', lunch({ personIds: [amy] })); // Ben still covers the lounge
    const gap = await breaks(admin, 'POST', '', {
      dayId: thu,
      start: '12:30',
      end: '13:00',
      personIds: [ben],
    });
    expect(gap.statusCode).toBe(409);
    expect(gap.json().error).toMatchObject({
      code: 'COVERAGE_GAP',
      message: 'Nobody would be left at Welcome Lounge (from 12:30).',
    });
    expect(await ctx.db.select().from(breakPeriod)).toHaveLength(1);

    const forced = await breaks(admin, 'POST', '', {
      dayId: thu,
      start: '12:30',
      end: '13:00',
      personIds: [ben],
      override: true,
    });
    expect(forced.json().added).toBe(1);
    // Back-to-back breaks leave the lounge covered.
    const ok = await breaks(admin, 'POST', '', {
      dayId: thu,
      start: '13:00',
      end: '13:30',
      personIds: [amy],
    });
    expect(ok.statusCode).toBe(200);
  });

  it('moves a whole slot and tells everyone in it; a label-only edit tells nobody', async () => {
    await breaks(admin, 'POST', '', lunch({ teams: ['Welfare'], override: true }));
    const slot = lunch();
    const moved = await breaks(admin, 'PATCH', '/slot', {
      slot,
      to: { start: '12:30', end: '13:15', label: 'Lunch' },
      override: true,
    });
    expect(moved.json()).toEqual({ updated: 1 });
    await breaks(admin, 'PATCH', '/slot', {
      slot: { ...slot, start: '12:30', end: '13:15' },
      to: { start: '12:30', end: '13:15', label: 'Late lunch' },
      override: true,
    });
    expect(await changesFor(cal)).toEqual([
      'Thu 7 Jan: Break 12:00–12:45 (Lunch) added',
      'Thu 7 Jan: Break 12:00–12:45 (Lunch) moved to 12:30–13:15',
    ]);
    const duty = await ctx.db.select().from(breakPeriod);
    expect(duty[0]!.label).toBe('Late lunch');
  });

  it('removes one person or the whole slot', async () => {
    await breaks(admin, 'POST', '', lunch({ personIds: [amy, cal], override: true }));
    const [first] = (await breaks(admin, 'GET', `?dayId=${thu}`)).json().slots[0].people;
    expect((await breaks(admin, 'DELETE', `/${first.breakId}`)).json()).toEqual({ removed: 1 });
    const q = new URLSearchParams(lunch()).toString();
    expect((await breaks(admin, 'DELETE', `/slot?${q}`)).json()).toEqual({ removed: 1 });
    expect(await ctx.db.select().from(breakPeriod)).toHaveLength(0);
    expect(await changesFor(amy)).toContain('Thu 7 Jan: Break 12:00–12:45 (Lunch) removed');
  });

  it('shows on My Duty and the board, and who is on break now (FR-BRK-5)', async () => {
    await breaks(admin, 'POST', '', lunch({ personIds: [cal], override: true }));
    ctx.clock.set('2027-01-07T04:10:00Z'); // 12:10 SGT
    const admin2 = await ctx.signIn('deputy'); // sessions end at midnight; same day, but re-sign for clarity
    const board = (
      await ctx.as(admin2, { method: 'GET', url: `/api/deployment/board?dayId=${thu}` })
    ).json();
    const byName = (n: string) => board.people.find((p: { name: string }) => p.name === n);
    expect(byName('Cal Ng').onBreakUntil).toBe('12:45');
    expect(byName('Amy Lim').onBreakUntil).toBeNull();
  });

  it('only Admins and the Welfare IC manage breaks (FR-AUTH-6)', async () => {
    const welfareIc = await ctx.signIn('ic', { team: 'Welfare' });
    const otherIc = await ctx.signIn('ic', { team: 'Room Ushers' });
    const vol = await ctx.signIn('volunteer');
    expect((await breaks(welfareIc, 'POST', '', lunch({ personIds: [amy] }))).statusCode).toBe(200);
    expect((await breaks(welfareIc, 'GET', `/people?dayId=${thu}`)).statusCode).toBe(200);
    expect((await breaks(otherIc, 'GET', `?dayId=${thu}`)).statusCode).toBe(403);
    expect((await breaks(otherIc, 'GET', `/people?dayId=${thu}`)).statusCode).toBe(403);
    expect((await breaks(vol, 'POST', '', lunch({ personIds: [amy] }))).statusCode).toBe(403);
  });

  it('rejects a break that ends before it starts', async () => {
    const res = await breaks(
      admin,
      'POST',
      '',
      lunch({ start: '13:00', end: '12:00', personIds: [amy] }),
    );
    expect(res.statusCode).toBe(400);
  });
});
