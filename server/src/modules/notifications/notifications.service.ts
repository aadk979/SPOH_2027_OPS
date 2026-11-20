import { and, desc, eq, sql } from 'drizzle-orm';
import type { CurrentUser, FailedEmail } from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { dutyChange, person } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';

/** People whose duty email failed after every retry (FR-NOTIF-3), newest first. */
export async function failedEmails(db: Db): Promise<{ failed: FailedEmail[]; queued: number }> {
  const rows = await db
    .select({
      personId: dutyChange.personId,
      name: person.name,
      email: person.email,
      changes: sql<number>`count(*)::int`,
      lastError: sql<
        string | null
      >`(array_agg(${dutyChange.emailError} order by ${dutyChange.createdAt} desc))[1]`,
      lastTriedAt: sql<string | null>`max(${dutyChange.createdAt})`,
    })
    .from(dutyChange)
    .innerJoin(person, eq(person.id, dutyChange.personId))
    .where(and(eq(dutyChange.emailStatus, 'failed'), eq(person.active, true)))
    .groupBy(dutyChange.personId, person.name, person.email)
    .orderBy(desc(sql`max(${dutyChange.createdAt})`));

  const [{ queued } = { queued: 0 }] = await db
    .select({ queued: sql<number>`count(distinct ${dutyChange.personId})::int` })
    .from(dutyChange)
    .where(eq(dutyChange.emailStatus, 'pending'));

  return {
    failed: rows.map((r) => ({
      ...r,
      lastTriedAt: r.lastTriedAt ? new Date(r.lastTriedAt).toISOString() : null,
    })),
    queued,
  };
}

/** Puts a person's failed emails back in the outbox for a fresh set of attempts. */
export async function retryEmails(db: Db, actor: CurrentUser, personId: string) {
  const rows = await db
    .update(dutyChange)
    .set({ emailStatus: 'pending', emailAttempts: 0, emailNextAttemptAt: null })
    .where(and(eq(dutyChange.personId, personId), eq(dutyChange.emailStatus, 'failed')))
    .returning({ id: dutyChange.id });
  await audit(db, { actorId: actor.id, action: 'email.retry', target: personId });
  return rows.length;
}
