import type { Db, Tx } from '../db/client.js';
import { auditLog } from '../db/schema/index.js';

/** Records who did what (FR-AUD-1). Call inside the same transaction as the change when possible. */
export async function audit(
  db: Db | Tx,
  entry: {
    actorId: string | null;
    action: string;
    target?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    target: entry.target ?? null,
    details: entry.details ?? null,
  });
}
