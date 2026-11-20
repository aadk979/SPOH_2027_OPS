import { and, asc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { AppDeps } from '../../deps.js';
import { dutyChange, person } from '../../db/schema/index.js';
import { codeForEmailLink, loginUrl } from '../auth/auth.service.js';

/** FR-NOTIF-2: changes within this window of the first one go out as one email. */
export const BATCH_WINDOW_MS = 2 * 60_000;
/** FR-NOTIF-3: three attempts, waiting 1 minute then 5 minutes between them. */
export const MAX_ATTEMPTS = 3;
export const BACKOFF_MS = [60_000, 5 * 60_000] as const;

type Deps = Pick<AppDeps, 'db' | 'clock' | 'email' | 'config'>;

export interface OutboxResult {
  sent: number;
  retrying: number;
  failed: number;
  skipped: number;
}

/**
 * One pass of the duty email outbox (architecture D4: duty_change rows are the outbox).
 * A person's pending changes are sent together once the oldest is 2 minutes old, so a
 * flurry of edits becomes one email and every email leaves within ~3 minutes (FR-NOTIF-1/2).
 */
export async function processOutbox(deps: Deps): Promise<OutboxResult> {
  const now = deps.clock.now();
  const result: OutboxResult = { sent: 0, retrying: 0, failed: 0, skipped: 0 };

  // Already seen in the app ("Got it") or the person was deactivated: nothing to email.
  const skipped = await deps.db
    .update(dutyChange)
    .set({ emailStatus: 'skipped' })
    .where(
      and(
        eq(dutyChange.emailStatus, 'pending'),
        or(
          isNotNull(dutyChange.acknowledgedAt),
          sql`${dutyChange.personId} in (select ${person.id} from ${person} where ${person.active} = false)`,
        ),
      ),
    )
    .returning({ id: dutyChange.id });
  result.skipped = skipped.length;

  const pending = await deps.db
    .select({
      id: dutyChange.id,
      personId: dutyChange.personId,
      summary: dutyChange.summary,
      createdAt: dutyChange.createdAt,
      attempts: dutyChange.emailAttempts,
      nextAttemptAt: dutyChange.emailNextAttemptAt,
      name: person.name,
      email: person.email,
    })
    .from(dutyChange)
    .innerJoin(person, eq(person.id, dutyChange.personId))
    .where(eq(dutyChange.emailStatus, 'pending'))
    .orderBy(asc(dutyChange.createdAt));

  const byPerson = new Map<string, typeof pending>();
  for (const r of pending) byPerson.set(r.personId, [...(byPerson.get(r.personId) ?? []), r]);
  for (const rows of byPerson.values()) {
    const first = rows[0]!;
    const windowClosed = now.getTime() - first.createdAt.getTime() >= BATCH_WINDOW_MS;
    const backoffOver = rows.every((r) => !r.nextAttemptAt || r.nextAttemptAt <= now);
    if (!windowClosed || !backoffOver) continue;

    const ids = rows.map((r) => r.id);
    const attempts = Math.max(...rows.map((r) => r.attempts)) + 1;
    try {
      const code = await codeForEmailLink(deps, first.personId);
      await deps.email.send(dutyEmail(deps, first, rows, code));
      await deps.db
        .update(dutyChange)
        .set({ emailStatus: 'sent', emailedAt: now, emailAttempts: attempts, emailError: null })
        .where(inArray(dutyChange.id, ids));
      result.sent += 1;
    } catch (err) {
      const giveUp = attempts >= MAX_ATTEMPTS;
      await deps.db
        .update(dutyChange)
        .set({
          emailStatus: giveUp ? 'failed' : 'pending',
          emailAttempts: attempts,
          emailNextAttemptAt: giveUp ? null : new Date(now.getTime() + BACKOFF_MS[attempts - 1]!),
          emailError: (err as Error).message.slice(0, 500),
        })
        .where(inArray(dutyChange.id, ids));
      result[giveUp ? 'failed' : 'retrying'] += 1;
    }
  }
  return result;
}

function dutyEmail(
  deps: Deps,
  to: { name: string; email: string },
  rows: { summary: string }[],
  code: string,
) {
  const link = loginUrl(deps, to.email, code, '/duty');
  const one = rows.length === 1;
  return {
    to: to.email,
    subject: one
      ? 'Your SPOH 2027 duty has changed'
      : `Your SPOH 2027 duty has changed (${rows.length} updates)`,
    text: [
      `Hi ${to.name},`,
      '',
      'Your duty has changed:',
      ...rows.map((r) => `  • ${r.summary}`),
      '',
      `Open My Duty and tap "Got it" to confirm you've seen this: ${link}`,
      '',
      'The link signs you in for 15 minutes. After that, sign in with your email as usual.',
    ].join('\n'),
  };
}
