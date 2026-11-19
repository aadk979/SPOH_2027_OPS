import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssignBody, AssignResponse, BoardResponse, UnackedResponse } from '@spoh/shared';
import { api } from '../../lib/api';

/** Admin views refresh every 15 s so acknowledgements show up without a reload. */
const REFRESH_MS = 15_000;

export function useBoard(dayId: string | null) {
  return useQuery({
    queryKey: ['board', dayId],
    queryFn: () => api<BoardResponse>(`/deployment/board?dayId=${dayId}`),
    enabled: dayId !== null,
    refetchInterval: REFRESH_MS,
    select: (r) => r.people,
  });
}

export function useUnacked(filter: { stationId: string; team: string }) {
  const params = new URLSearchParams();
  if (filter.stationId) params.set('stationId', filter.stationId);
  if (filter.team) params.set('team', filter.team);
  const query = params.toString();
  return useQuery({
    queryKey: ['unacked', query],
    queryFn: () => api<UnackedResponse>(`/deployment/unacked${query ? `?${query}` : ''}`),
    refetchInterval: REFRESH_MS,
    select: (r) => r.changes,
  });
}

export function useAssign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignBody) =>
      api<AssignResponse>('/deployment/assign', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      for (const key of ['board', 'unacked', 'team', 'duty']) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
