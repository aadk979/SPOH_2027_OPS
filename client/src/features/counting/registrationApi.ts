import { useQuery } from '@tanstack/react-query';
import type { RegCategory, RegistrationSummary } from '@spoh/shared';
import { api } from '../../lib/api';
import { getDeviceId } from './device';
import { TapQueue } from './tapQueue';

/*
 * Registration only (FR-REG-*). Rule 1: this file never touches footfall; its cache key,
 * queue and endpoint are separate from footfallApi.ts.
 */

export interface RegistrationPayload {
  stationId: string;
  deviceId: string;
  groupId: string | null;
  records: { clientId: string; category: RegCategory }[];
}

/** Give up on one attempt after 8 s so a stalled connection turns into a retry. */
const ATTEMPT_TIMEOUT_MS = 8_000;

/** One queue per browser tab, so pending taps keep retrying while the user changes screen. */
export const registrationQueue = new TapQueue<RegistrationPayload>({
  send: (payload) =>
    api('/registrations', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    }),
});

export const registrationSummaryKey = (stationId: string) =>
  ['registration-summary', stationId, getDeviceId()] as const;

export function useRegistrationSummary(stationId: string) {
  return useQuery({
    queryKey: registrationSummaryKey(stationId),
    queryFn: () =>
      api<RegistrationSummary>(
        `/registrations/summary?${new URLSearchParams({ stationId, deviceId: getDeviceId() })}`,
      ),
    refetchInterval: 10_000,
  });
}

export const undoRegistration = (clientId: string) =>
  api(`/registrations/${clientId}`, { method: 'DELETE' });

/** Adds (sign 1) or removes (sign -1) a saved tap from a cached summary. */
export function applyRegistration(
  summary: RegistrationSummary,
  payload: RegistrationPayload,
  sign: 1 | -1,
): RegistrationSummary {
  const byCategory = { ...summary.byCategory };
  for (const r of payload.records) byCategory[r.category] = (byCategory[r.category] ?? 0) + sign;
  const n = payload.records.length * sign;
  const mine = payload.deviceId === getDeviceId() ? n : 0;
  return { ...summary, total: summary.total + n, device: summary.device + mine, byCategory };
}
