import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestContext } from '../../../test/helpers/test-app.js';
import { ensureBootstrapCC } from './bootstrap.js';

describe('people API', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(() => ctx.close());

  const newVolunteer = {
    name: 'Alex',
    email: 'Alex.25@ichat.sp.edu.sg',
    rank: 'volunteer',
    team: 'Relief',
    phone: '9123 4567',
  };

  it('T-09: volunteers and ICs cannot list people or see contact details', async () => {
    for (const rank of ['volunteer', 'ic'] as const) {
      const user = await ctx.signIn(rank);
      expect((await ctx.as(user, { method: 'GET', url: '/api/people' })).statusCode).toBe(403);
    }
  });

  it('lets Admins (incl. Shadow ICs) add and edit people', async () => {
    const shadow = await ctx.signIn('shadow_ic');
    const created = await ctx.as(shadow, {
      method: 'POST',
      url: '/api/people',
      payload: newVolunteer,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ email: 'alex.25@ichat.sp.edu.sg', phone: '91234567' });

    const id = created.json().id;
    const edited = await ctx.as(shadow, {
      method: 'PATCH',
      url: `/api/people/${id}`,
      payload: { team: 'Guides' },
    });
    expect(edited.json().team).toBe('Guides');
  });

  it('enforces team/portfolio rules per rank', async () => {
    const admin = await ctx.signIn('deputy');
    const res = await ctx.as(admin, {
      method: 'POST',
      url: '/api/people',
      payload: { ...newVolunteer, team: 'Not A Team' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].field).toBe('team');
  });

  it('rejects duplicate emails', async () => {
    const admin = await ctx.signIn('deputy');
    await ctx.as(admin, { method: 'POST', url: '/api/people', payload: newVolunteer });
    const dup = await ctx.as(admin, { method: 'POST', url: '/api/people', payload: newVolunteer });
    expect(dup.statusCode).toBe(409);
  });

  it('only the CC can create or change a CC', async () => {
    const deputy = await ctx.signIn('deputy');
    const cc = await ctx.signIn('cc');
    const asDeputy = await ctx.as(deputy, {
      method: 'POST',
      url: '/api/people',
      payload: { name: 'X', email: 'x@ichat.sp.edu.sg', rank: 'cc' },
    });
    expect(asDeputy.statusCode).toBe(403);
    const demote = await ctx.as(deputy, {
      method: 'PATCH',
      url: `/api/people/${cc.id}`,
      payload: { active: false },
    });
    expect(demote.statusCode).toBe(403);
  });

  it('a partial edit (e.g. Deactivate) leaves every other field untouched', async () => {
    const admin = await ctx.signIn('deputy');
    const created = await ctx.as(admin, {
      method: 'POST',
      url: '/api/people',
      payload: { ...newVolunteer, course: 'DCS' },
    });
    const id = created.json().id as string;
    const res = await ctx.as(admin, {
      method: 'PATCH',
      url: `/api/people/${id}`,
      payload: { active: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      active: false,
      phone: '91234567',
      course: 'DCS',
      team: 'Relief',
    });
  });

  it('blocks deactivating yourself', async () => {
    const cc = await ctx.signIn('cc');
    const res = await ctx.as(cc, {
      method: 'PATCH',
      url: `/api/people/${cc.id}`,
      payload: { active: false },
    });
    expect(res.statusCode).toBe(400);
  });

  it('bootstraps the first CC once from BOOTSTRAP_CC_EMAIL', async () => {
    expect(await ensureBootstrapCC(ctx.db, 'Chief@ichat.sp.edu.sg')).toBe(true);
    expect(await ensureBootstrapCC(ctx.db, 'chief@ichat.sp.edu.sg')).toBe(false);
    expect(await ensureBootstrapCC(ctx.db, undefined)).toBe(false);
  });
});
