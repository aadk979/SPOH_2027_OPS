import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../config.js';
import { dutyChange } from '../../db/schema/index.js';
import type { EmailMessage, EmailSender } from '../../email/index.js';
import {
  createTestApp,
  type TestContext,
  type TestPerson,
} from '../../../test/helpers/test-app.js';
import { stationId } from '../../../test/helpers/counting.js';
import { assignAs, seededDays } from '../../../test/helpers/deployment.js';
import { processOutbox } from './outbox.js';

const MIN = 60_000;

/** An email sender that fails the first `failures` sends, then records the rest. */
class FlakySender implements EmailSender {
  readonly name = 'flaky';
  readonly sent: EmailMessage[] = [];
  constructor(private failures: number) {}
  async send(message: EmailMessage) {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('SMTP 421 try again later');
    }
    this.sent.push(message);
  }
}

describe('duty email outbox (FR-NOTIF-1/2/3)', () => {
  let ctx: TestContext;
  let admin: TestPerson;
  let vol: TestPerson;
  let thu: string;
  let lounge: string;
  let counsel: string;
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite://memory',
    PUBLIC_APP_URL: 'https://ops.example.test',
  });
  const run = (email: EmailSender) =>
    processOutbox({ db: ctx.db, clock: ctx.clock, email, config });
  const move = (to: string) =>
    assignAs(ctx, admin, { personIds: [vol.id], stationId: to, dayIds: [thu], override: true });

  beforeEach(async () => {
    ctx = await createTestApp();
    admin = await ctx.signIn('deputy');
    vol = await ctx.signIn('volunteer', { name: 'Riya Tan' });
    thu = (await seededDays(ctx.db))['2027-01-07']!;
    lounge = await stationId(ctx.db, 'Welcome Lounge');
    counsel = await stationId(ctx.db, 'Counselling Room');
  });
  afterEach(() => ctx.close());

  it('batches quick edits into one email sent within 3 minutes, with a sign-in link', async () => {
    const sender = new FlakySender(0);
    await move(lounge);
    ctx.clock.advance(30_000);
    await move(counsel);
    ctx.clock.advance(30_000);
    await move(lounge);

    expect((await run(sender)).sent).toBe(0); // still inside the 2-minute window
    ctx.clock.advance(1 * MIN);
    expect((await run(sender)).sent).toBe(1); // 2 min after the first edit

    expect(sender.sent).toHaveLength(1);
    const email = sender.sent[0]!;
    expect(email.to).toBe(vol.email);
    expect(email.subject).toBe('Your SPOH 2027 duty has changed (3 updates)');
    expect(email.text).toContain('Thu 7 Jan: Welcome Lounge → Counselling Room');
    const link = email.text.match(/https:\/\/ops\.example\.test\/login#(\S+)/)![1]!;
    const params = new URLSearchParams(link);
    expect(params.get('next')).toBe('/duty');

    // The link's code signs them in.
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      payload: { email: params.get('email'), code: params.get('code') },
    });
    expect(res.statusCode).toBe(200);
    expect((await run(sender)).sent).toBe(0); // nothing sent twice
  });

  it('skips changes already acknowledged in the app', async () => {
    await move(lounge);
    const [change] = await ctx.db.select().from(dutyChange);
    await ctx.as(vol, { method: 'POST', url: '/api/duty/ack', payload: { ids: [change!.id] } });
    ctx.clock.advance(2 * MIN);
    const sender = new FlakySender(0);
    expect(await run(sender)).toMatchObject({ sent: 0, skipped: 1 });
    expect(sender.sent).toHaveLength(0);
  });

  it('retries with back-off, then marks failed and shows Admins (FR-NOTIF-3)', async () => {
    await move(lounge);
    ctx.clock.advance(2 * MIN);
    const sender = new FlakySender(5);

    expect((await run(sender)).retrying).toBe(1); // attempt 1
    expect((await run(sender)).retrying).toBe(0); // waiting 1 minute
    ctx.clock.advance(1 * MIN);
    expect((await run(sender)).retrying).toBe(1); // attempt 2
    ctx.clock.advance(5 * MIN);
    expect((await run(sender)).failed).toBe(1); // attempt 3: give up

    const res = await ctx.as(admin, { method: 'GET', url: '/api/notifications/failed' });
    expect(res.json().failed).toEqual([
      expect.objectContaining({
        personId: vol.id,
        name: 'Riya Tan',
        changes: 1,
        lastError: 'SMTP 421 try again later',
      }),
    ]);
    const forbidden = await ctx.as(vol, { method: 'GET', url: '/api/notifications/failed' });
    expect(forbidden.statusCode).toBe(403);

    // Retry puts it back in the outbox; the next pass delivers it.
    const retry = await ctx.as(admin, {
      method: 'POST',
      url: '/api/notifications/retry',
      payload: { personId: vol.id },
    });
    expect(retry.json()).toEqual({ requeued: 1 });
    const healthy = new FlakySender(0);
    expect((await run(healthy)).sent).toBe(1);
    const [row] = await ctx.db.select().from(dutyChange).where(eq(dutyChange.personId, vol.id));
    expect(row).toMatchObject({ emailStatus: 'sent', emailError: null });
  });

  it('sign-in still answers normally when the email provider is down (FR-AUTH-2)', async () => {
    const broken = await createTestApp();
    broken.email.send = async () => {
      throw new Error('SMTP down');
    };
    const res = await broken.app.inject({
      method: 'POST',
      url: '/api/auth/request',
      payload: { email: 'nobody@ichat.sp.edu.sg' },
    });
    expect(res.statusCode).toBe(200);
    await broken.close();
  });
});
