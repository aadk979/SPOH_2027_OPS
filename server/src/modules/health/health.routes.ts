import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppPlugin } from '../../types.js';

const HealthResponse = z.object({
  status: z.literal('ok'),
  db: z.enum(['ok', 'down']),
  time: z.string(),
});

/** GET /api/health — used by hosting health checks and the pre-event warm-up ping. */
export const healthRoutes: AppPlugin = async (app, { deps }) => {
  app.get('/health', { schema: { response: { 200: HealthResponse } } }, async () => {
    let db: 'ok' | 'down' = 'ok';
    try {
      await deps.db.execute(sql`select 1`);
    } catch {
      db = 'down';
    }
    return { status: 'ok' as const, db, time: deps.clock.now().toISOString() };
  });
};
