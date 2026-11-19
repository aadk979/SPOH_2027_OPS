import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assignment, dutyChange, person } from '../../db/schema/index.js';
import {
  createTestApp,
  type TestContext,
  type TestPerson,
} from '../../../test/helpers/test-app.js';
import { stationId } from '../../../test/helpers/counting.js';
import { addPerson, assignAs, seededDays } from '../../../test/helpers/deployment.js';

describe('deployment API', () => {
  let ctx: TestContext;
  let admin: TestPerson;
  let days: Record<string, string>;
  let lounge: string;
  let counsel: string;
  const thu = () => days['2027-01-07']!;
  const fri = () => days['2027-01-08']!;

  beforeEach(async () => {
    ctx = await createTestApp(); // clock: Thu 7 Jan 2027, 10:00 SGT
    admin = await ctx.signIn('deputy');
    days = await seededDays(ctx.db);
    lounge = await stationId(ctx.db, 'Welcome Lounge');
    counsel = await stationId(ctx.db, 'Counselling Room');
  });
  afterEach(() => ctx.close());

  const board = async (dayId: string) =>
    (await ctx.as(admin, { method: 'GET', url: `/api/deployment/board?dayId=${dayId}` })).json()
      .people as { id: string; stationId: string | null; later: unknown[]; unacked: number }[];

  it('bulk-assigns 30 people to a station on two days in one request (FR-DUTY-2)', async () => {
    const ids = await Promise.all(
      Array.from({ length: 30 }, () => addPerson(ctx.db, { days: [thu(), fri()] })),
    );
    const res = await assignAs(ctx, admin, {
      personIds: ids,
      stationId: lounge,
      dayIds: [thu(), fri()],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ assigned: 60, unchanged: 0 });
    const people = await board(thu());
    expect(people.filter((p) => p.stationId === lounge)).toHaveLength(30);
    expect(await ctx.db.select().from(dutyChange)).toHaveLength(60);
  });

  it('warns when someone is not available, and assigns on override (FR-DUTY-4)', async () => {
    const id = await addPerson(ctx.db, { name: 'Hari Kumar', days: [thu()] });
    const res = await assignAs(ctx, admin, {
      personIds: [id],
      stationId: lounge,
      dayIds: [thu(), fri()],
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('NOT_AVAILABLE');
    expect(res.json().error.details).toEqual([
      { personId: id, name: 'Hari Kumar', dayId: fri(), day: 'Fri 8 Jan' },
    ]);
    expect(await ctx.db.select().from(assignment)).toHaveLength(0);

    const forced = await assignAs(ctx, admin, {
      personIds: [id],
      stationId: lounge,
      dayIds: [thu(), fri()],
      override: true,
    });
    expect(forced.json()).toEqual({ assigned: 2, unchanged: 0 });
  });

  it('reassigns from a chosen time, keeps history, and records the change (FR-DUTY-3/6)', async () => {
    const id = await addPerson(ctx.db, { days: [thu()] });
    await assignAs(ctx, admin, { personIds: [id], stationId: lounge, dayIds: [thu()] });
    const res = await assignAs(ctx, admin, {
      personIds: [id],
      stationId: counsel,
      dayIds: [thu()],
      from: '13:00',
    });
    expect(res.json()).toEqual({ assigned: 1, unchanged: 0 });

    const [me] = await board(thu()).then((ps) => ps.filter((p) => p.id === id));
    expect(me).toMatchObject({ stationId: lounge, later: [{ from: '13:00', stationId: counsel }] });
    expect(await ctx.db.select().from(assignment).where(eq(assignment.personId, id))).toHaveLength(
      2,
    );
    const changes = await ctx.db.select().from(dutyChange).where(eq(dutyChange.personId, id));
    expect(changes.map((c) => c.summary)).toEqual([
      'Thu 7 Jan: Welcome Lounge from 10:00',
      'Thu 7 Jan: Welcome Lounge → Counselling Room from 13:00',
    ]);

    ctx.clock.set('2027-01-07T05:30:00Z'); // 13:30 SGT
    expect((await board(thu())).find((p) => p.id === id)?.stationId).toBe(counsel);
  });

  it('a future day is planned from its start, and no-op moves are skipped', async () => {
    const id = await addPerson(ctx.db, { days: [fri()] });
    await assignAs(ctx, admin, { personIds: [id], stationId: lounge, dayIds: [fri()] });
    const again = await assignAs(ctx, admin, {
      personIds: [id],
      stationId: lounge,
      dayIds: [fri()],
    });
    expect(again.json()).toEqual({ assigned: 0, unchanged: 1 });
    const [change] = await ctx.db.select().from(dutyChange).where(eq(dutyChange.personId, id));
    expect(change!.summary).toBe('Fri 8 Jan: Welcome Lounge');
  });

  it('T-14: assigning works on any date, including a day already over', async () => {
    ctx.clock.set('2027-03-01T02:00:00Z');
    admin = await ctx.signIn('deputy'); // yesterday's session has ended
    const id = await addPerson(ctx.db, { days: [thu()] });
    const res = await assignAs(ctx, admin, { personIds: [id], stationId: lounge, dayIds: [thu()] });
    expect(res.statusCode).toBe(200);
    expect((await board(thu())).find((p) => p.id === id)?.stationId).toBe(lounge);
  });

  it('T-09 / FR-DUTY-9: ICs and volunteers cannot assign or see the board', async () => {
    const id = await addPerson(ctx.db, { days: [thu()] });
    for (const rank of ['ic', 'volunteer'] as const) {
      const user = await ctx.signIn(rank);
      const res = await assignAs(ctx, user, {
        personIds: [id],
        stationId: lounge,
        dayIds: [thu()],
      });
      expect(res.statusCode).toBe(403);
      const view = await ctx.as(user, {
        method: 'GET',
        url: `/api/deployment/board?dayId=${thu()}`,
      });
      expect(view.statusCode).toBe(403);
    }
    expect(await ctx.db.select().from(assignment)).toHaveLength(0);
  });

  it('rejects a closed station and people no longer on the roster', async () => {
    const id = await addPerson(ctx.db, { days: [thu()] });
    await ctx.as(admin, {
      method: 'PATCH',
      url: `/api/setup/stations/${counsel}`,
      payload: { active: false },
    });
    const closed = await assignAs(ctx, admin, {
      personIds: [id],
      stationId: counsel,
      dayIds: [thu()],
    });
    expect(closed.statusCode).toBe(400);

    await ctx.db.update(person).set({ active: false }).where(eq(person.id, id));
    const gone = await assignAs(ctx, admin, {
      personIds: [id],
      stationId: lounge,
      dayIds: [thu()],
    });
    expect(gone.statusCode).toBe(400);
  });

  it('lists unacknowledged changes, filtered by station and team (FR-DUTY-8)', async () => {
    const a = await addPerson(ctx.db, { team: 'Room Ushers', days: [thu()] });
    const b = await addPerson(ctx.db, { team: 'Guides', days: [thu()] });
    await assignAs(ctx, admin, { personIds: [a], stationId: lounge, dayIds: [thu()] });
    await assignAs(ctx, admin, { personIds: [b], stationId: counsel, dayIds: [thu()] });

    const get = async (query = '') =>
      (await ctx.as(admin, { method: 'GET', url: `/api/deployment/unacked${query}` })).json()
        .changes as { personId: string; stationId: string }[];
    expect(await get()).toHaveLength(2);
    expect((await get(`?stationId=${counsel}`)).map((c) => c.personId)).toEqual([b]);
    expect((await get('?team=Room%20Ushers')).map((c) => c.personId)).toEqual([a]);
  });
});
