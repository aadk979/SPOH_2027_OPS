import type { FastifyBaseLogger } from 'fastify';
import type { AppDeps } from '../../deps.js';
import { processOutbox } from './outbox.js';

export const OUTBOX_INTERVAL_MS = 30_000;

/**
 * Runs the outbox every 30 s inside the server process (one instance, so no locking).
 * A pass never overlaps the previous one. Returns a stop function for shutdown.
 */
export function startOutbox(
  deps: AppDeps,
  log: FastifyBaseLogger,
  intervalMs = OUTBOX_INTERVAL_MS,
) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await processOutbox(deps);
      if (r.sent + r.retrying + r.failed > 0) log.info({ outbox: r }, 'Duty emails processed');
    } catch (err) {
      log.error({ err }, 'Outbox pass failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(timer);
}
