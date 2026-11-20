import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { person } from '../../db/schema/index.js';
import { createTestApp, type TestContext } from '../../../test/helpers/test-app.js';

/** T-11: login code single use, expiry, lockout, no roster leakage (FR-AUTH-1…5). */
describe('auth', () => {
  let ctx: TestContext;
  const email = 'alex.25@ichat.sp.edu.sg';

  beforeEach(async () => {
    ctx = await createTestApp();
    await ctx.db
      .insert(person)
      .values({ name: 'Alex', email, rank: 'volunteer', team: 'Sign-Up Booth' });
  });
  afterEach(() => ctx.close());

  const request = (address: string) =>
    ctx.app.inject({ method: 'POST', url: '/api/auth/request', payload: { email: address } });
  const verify = (address: string, code: string) =>
    ctx.app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: address, code } });
  const lastCode = () => ctx.email.last()!.subject.match(/(\d{6})$/)![1]!;

  it('emails a 6-digit code and a magic link to roster members', async () => {
    const res = await request('  ALEX.25@ichat.sp.edu.sg ');
    expect(res.statusCode).toBe(200);
    expect(ctx.email.sent).toHaveLength(1);
    expect(ctx.email.last()!.to).toBe(email);
    expect(ctx.email.last()!.text).toContain(
      `/login#email=${encodeURIComponent(email)}&code=${lastCode()}`,
    );
  });

  it('gives unknown emails the same response and sends nothing (no roster leakage)', async () => {
    const known = await request(email);
    const unknown = await request('stranger@ichat.sp.edu.sg');
    expect(unknown.statusCode).toBe(known.statusCode);
    expect(unknown.json()).toEqual(known.json());
    expect(ctx.email.sent).toHaveLength(1);
  });

  it('exchanges a code for a session that ends at 23:59 SGT, and the code works once', async () => {
    await request(email);
    const code = lastCode();
    const ok = await verify(email, code);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user).toMatchObject({ email, tier: 'volunteer', canManageBreaks: false });
    expect(ok.json().expiresAt).toBe('2027-01-07T15:59:59.999Z');

    const again = await verify(email, code);
    expect(again.statusCode).toBe(401);
    expect(again.json().error.code).toBe('INVALID_CODE');
  });

  it('accepts an earlier unexpired code after a newer one was sent (e.g. a duty email)', async () => {
    await request(email);
    const first = lastCode();
    await request(email);
    expect(lastCode()).not.toBe(first);
    expect((await verify(email, first)).statusCode).toBe(200);
  });

  it('rejects an expired code', async () => {
    await request(email);
    ctx.clock.advance(16 * 60_000);
    expect((await verify(email, lastCode())).statusCode).toBe(401);
  });

  it('locks out after 5 wrong codes for 10 minutes', async () => {
    await request(email);
    const good = lastCode();
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) expect((await verify(email, wrong)).statusCode).toBe(401);

    const locked = await verify(email, good);
    expect(locked.statusCode).toBe(429);
    await request(email);
    expect(ctx.email.sent).toHaveLength(1); // no new code while locked

    ctx.clock.advance(11 * 60_000);
    await request(email);
    expect((await verify(email, lastCode())).statusCode).toBe(200);
  });

  it('validates input shape', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      payload: { email, code: '12' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('serves /me with a token, 401 without, and logout ends the session', async () => {
    const me = await ctx.signIn('ic', { team: 'Welfare' });
    const res = await ctx.as(me, { method: 'GET', url: '/api/me' });
    expect(res.json()).toMatchObject({ tier: 'ic', canManageBreaks: true });

    expect((await ctx.as(null, { method: 'GET', url: '/api/me' })).statusCode).toBe(401);

    await ctx.as(me, { method: 'POST', url: '/api/auth/logout' });
    expect((await ctx.as(me, { method: 'GET', url: '/api/me' })).statusCode).toBe(401);
  });

  it('expires sessions at midnight SGT', async () => {
    const me = await ctx.signIn('volunteer');
    ctx.clock.set('2027-01-07T16:00:01Z'); // 00:00:01 SGT 8 Jan
    expect((await ctx.as(me, { method: 'GET', url: '/api/me' })).statusCode).toBe(401);
  });

  it('lets an Admin issue an on-screen code (FR-AUTH-5) but not a volunteer', async () => {
    const [target] = await ctx.db.select().from(person);
    const admin = await ctx.signIn('deputy');
    const vol = await ctx.signIn('volunteer');

    const denied = await ctx.as(vol, { method: 'POST', url: `/api/auth/issue-code/${target!.id}` });
    expect(denied.statusCode).toBe(403);

    const issued = await ctx.as(admin, {
      method: 'POST',
      url: `/api/auth/issue-code/${target!.id}`,
    });
    expect(issued.statusCode).toBe(200);
    expect((await verify(email, issued.json().code)).statusCode).toBe(200);
  });

  it('refuses deactivated people', async () => {
    const me = await ctx.signIn('volunteer');
    const { eq } = await import('drizzle-orm');
    await ctx.db.update(person).set({ active: false }).where(eq(person.id, me.id));
    expect((await ctx.as(me, { method: 'GET', url: '/api/me' })).statusCode).toBe(401);
  });
});
