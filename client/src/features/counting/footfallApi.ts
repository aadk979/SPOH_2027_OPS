import { useQuery } from '@tanstack/react-query';
import type { CounsellingCourse, FootfallSummary, FootfallVariant } from '@spoh/shared';
import { api } from '../../lib/api';
import { getDeviceId } from './device';
import { TapQueue } from './tapQueue';

/*
 * Footfall only (FR-FOOT-*). Rule 1: this file never touches registrations; its cache key,
 * queue and endpoint are separate from registrationApi.ts.
 */

export interface FootfallPayload {
  stationId: string;
  deviceId: string;
  records: {
    clientId: string;
    variant: FootfallVariant;
    count: number;
    course: CounsellingCourse | null;
  }[];
}

const ATTEMPT_TIMEOUT_MS = 8_000;

export const footfallQueue = new TapQueue<FootfallPayload>({
  send: (payload) =>
    api('/footfall', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    }),
});

export const footfallSummaryKey = (stationId: string) =>
  ['footfall-summary', stationId, getDeviceId()] as const;

export function useFootfallSummary(stationId: string) {
  return useQuery({
    queryKey: footfallSummaryKey(stationId),
    queryFn: () =>
      api<FootfallSummary>(
        `/footfall/summary?${new URLSearchParams({ stationId, deviceId: getDeviceId() })}`,
      ),
    refetchInterval: 10_000,
  });
}

export const undoFootfall = (clientId: string) =>
  api(`/footfall/${clientId}`, { method: 'DELETE' });

export function applyFootfall(
  summary: FootfallSummary,
  payload: FootfallPayload,
  sign: 1 | -1,
): FootfallSummary {
  const byVariant = { ...summary.byVariant };
  let n = 0;
  for (const r of payload.records) {
    byVariant[r.variant] = (byVariant[r.variant] ?? 0) + r.count * sign;
    n += r.count * sign;
  }
  const mine = payload.deviceId === getDeviceId() ? n : 0;
  return { ...summary, total: summary.total + n, device: summary.device + mine, byVariant };
}

/** People per variant still waiting to be saved (shown optimistically). */
export function pendingByVariant(payloads: FootfallPayload[]): Record<FootfallVariant, number> {
  const out: Record<FootfallVariant, number> = { entry: 0, guided: 0, walk_in: 0 };
  for (const p of payloads) for (const r of p.records) out[r.variant] += r.count;
  return out;
}
