import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AckResponse, MyDutyResponse, TeamResponse } from '@spoh/shared';
import { api } from '../../lib/api';

/** Polls so an Admin's change shows within 15 s (FR-DUTY-5 AC). */
const DUTY_REFRESH_MS = 10_000;

export function useMyDuty() {
  return useQuery({
    queryKey: ['duty'],
    queryFn: () => api<MyDutyResponse>('/duty/me'),
    refetchInterval: DUTY_REFRESH_MS,
  });
}

export function useAcknowledge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<AckResponse>('/duty/ack', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: (_r, ids) => {
      client.setQueryData<MyDutyResponse>(['duty'], (old) =>
        old ? { ...old, pending: old.pending.filter((p) => !ids.includes(p.id)) } : old,
      );
      void client.invalidateQueries({ queryKey: ['duty'] });
    },
  });
}

export function useTeam(dayId: string | null) {
  return useQuery({
    queryKey: ['team', dayId],
    queryFn: () => api<TeamResponse>(`/team${dayId ? `?dayId=${dayId}` : ''}`),
    refetchInterval: 15_000,
  });
}
