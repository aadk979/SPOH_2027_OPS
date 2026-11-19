import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { person } from '../../db/schema/index.js';

/**
 * Fresh install: there is no roster yet, so nobody could log in to import one.
 * If BOOTSTRAP_CC_EMAIL is set and that email isn't on the roster, create it as the CC.
 * Idempotent; never changes an existing person.
 */
export async function ensureBootstrapCC(db: Db, email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const normalised = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: person.id })
    .from(person)
    .where(eq(person.email, normalised));
  if (existing) return false;
  await db.insert(person).values({ name: 'Chief Coordinator', email: normalised, rank: 'cc' });
  return true;
}
