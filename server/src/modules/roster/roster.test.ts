import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { person } from '../../db/schema/index.js';
import {
  createTestApp,
  type TestContext,
  type TestPerson,
} from '../../../test/helpers/test-app.js';

const HEADER =
  'name,email,phone,course,rank,team,shadows,day_2027-01-06,day_2027-01-07,day_2027-01-08,day_2027-01-09';
const file = (...rows: string[]) => ({ csv: [HEADER, ...rows].join('\n') });

/** T-10 and CC-only access for roster import (FR-CFG-1…3). */
describe('roster import API', () => {
  let ctx: TestContext;
  let cc: TestPerson;

  beforeEach(async () => {
    ctx = await createTestApp();
    cc = await ctx.signIn('cc');
  });
  afterEach(() => ctx.close());

  const post = (user: TestPerson, url: string, payload: object) =>
    ctx.as(user, { method: 'POST', url, payload });

  it('is CC-only: Deputies get 403', async () => {
    const deputy = await ctx.signIn('deputy');
    expect((await post(deputy, '/api/roster/preview', file())).statusCode).toBe(403);
    expect(
      (await ctx.as(deputy, { method: 'GET', url: '/api/roster/template.csv' })).statusCode,
    ).toBe(403);
  });

  it('downloads a template whose columns match the configured days', async () => {
    const res = await ctx.as(cc, { method: 'GET', url: '/api/roster/template.csv' });
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body.trim()).toBe(HEADER);
  });

  it('previews without saving, then commits all-or-nothing', async () => {
    const body = file(
      'Alex,alex.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y,Y,Y',
      'Bea,bea.25@ichat.sp.edu.sg,,,IC,Relief,,N,Y,Y,N',
    );
    const preview = await post(cc, '/api/roster/preview', body);
    expect(preview.json().summary).toEqual({ new: 2, updated: 0, unchanged: 0, errors: 0 });
    expect(await ctx.db.select().from(person)).toHaveLength(1); // only the CC

    const commit = await post(cc, '/api/roster/commit', body);
    expect(commit.json()).toEqual({ created: 2, updated: 0, unchanged: 0 });
    expect(await ctx.db.select().from(person)).toHaveLength(3);
  });

  it('saves nothing when any row is invalid', async () => {
    const res = await post(
      cc,
      '/api/roster/commit',
      file(
        'Alex,alex.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y,Y,Y',
        'Bad,bad.25@ichat.sp.edu.sg,,,Vol,Relief,,Y,Y,Y,Y',
      ),
    );
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('ROSTER_INVALID');
    expect(res.json().error.details[0]).toMatchObject({ row: 3, column: 'rank' });
    expect(await ctx.db.select().from(person)).toHaveLength(1);
  });

  it('re-import updates by email, never duplicates, and lists missing people', async () => {
    await post(
      cc,
      '/api/roster/commit',
      file(
        'Alex,alex.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y,Y,Y',
        'Bea,bea.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y,Y,Y',
      ),
    );
    const second = file(
      'Alex Tan,alex.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y,Y,Y',
      'Cal,cal.25@ichat.sp.edu.sg,,,Volunteer,Guides,,Y,Y,Y,Y',
    );
    const preview = (await post(cc, '/api/roster/preview', second)).json();
    expect(preview.summary).toMatchObject({ new: 1, updated: 1, unchanged: 0 });
    // The importing CC is never offered for deactivation.
    expect(preview.missing.map((m: { email: string }) => m.email)).toEqual([
      'bea.25@ichat.sp.edu.sg',
    ]);

    await post(cc, '/api/roster/commit', second);
    const people = await ctx.db.select().from(person);
    expect(people).toHaveLength(4);
    expect(people.find((p) => p.email === 'alex.25@ichat.sp.edu.sg')!.name).toBe('Alex Tan');
    expect(people.find((p) => p.email === 'bea.25@ichat.sp.edu.sg')!.active).toBe(true); // kept
  });

  it('deactivates selected missing people but never the CC themself', async () => {
    await post(
      cc,
      '/api/roster/commit',
      file('Bea,bea.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y,Y,Y'),
    );
    const bea = (await ctx.db.select().from(person)).find((p) => p.email.startsWith('bea'))!;
    const res = await post(cc, '/api/roster/deactivate', { ids: [bea.id, cc.id] });
    expect(res.json()).toEqual({ deactivated: 1 });
  });
});
