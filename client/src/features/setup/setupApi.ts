import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  DayImpact,
  DayInput,
  DayPatch,
  EventDayDto,
  StationAdminDto,
  StationInput,
  StationPatch,
  StationsAdminResponse,
  Thresholds,
} from '@spoh/shared';
import { api } from '../../lib/api';

/** Days feed many screens (people, deployment, duty), so a change refreshes them all. */
function refreshDayViews(client: QueryClient) {
  for (const key of ['days', 'people', 'board', 'unacked', 'duty', 'team']) {
    void client.invalidateQueries({ queryKey: [key] });
  }
}

export function useSaveDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: DayInput | DayPatch }) =>
      id
        ? api<EventDayDto>(`/days/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api<EventDayDto>('/days', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => refreshDayViews(client),
  });
}

export function useDayImpact(id: string | null) {
  return useQuery({
    queryKey: ['day-impact', id],
    queryFn: () => api<DayImpact>(`/days/${id}/impact`),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useDeleteDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<DayImpact>(`/days/${id}?confirm=true`, { method: 'DELETE' }),
    onSuccess: () => refreshDayViews(client),
  });
}

export function useAdminStations() {
  return useQuery({
    queryKey: ['setup-stations'],
    queryFn: () => api<StationsAdminResponse>('/setup/stations'),
    select: (r) => r.stations,
  });
}

export function useSaveStation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: StationInput | StationPatch }) =>
      id
        ? api<StationAdminDto>(`/setup/stations/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api<StationAdminDto>('/setup/stations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['setup-stations'] });
      void client.invalidateQueries({ queryKey: ['stations'] });
    },
  });
}

export function useThresholds() {
  return useQuery({
    queryKey: ['thresholds'],
    queryFn: () => api<Thresholds>('/setup/thresholds'),
  });
}

export function useSaveThresholds() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Thresholds) =>
      api<Thresholds>('/setup/thresholds', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (saved) => client.setQueryData(['thresholds'], saved),
  });
}
