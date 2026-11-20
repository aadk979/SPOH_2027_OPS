import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddBreakInput,
  AddBreakResponse,
  BoardResponse,
  BreaksResponse,
  EditSlotInput,
  RemovedResponse,
  SlotRef,
  StationsResponse,
} from '@spoh/shared';
import { api } from '../../lib/api';

const REFRESH_MS = 15_000;

export function useBreaks(dayId: string | null) {
  return useQuery({
    queryKey: ['breaks', dayId],
    queryFn: () => api<BreaksResponse>(`/breaks?dayId=${dayId}`),
    enabled: dayId !== null,
    refetchInterval: REFRESH_MS,
    select: (r) => r.slots,
  });
}

/** People with their posts on the day, for picking who goes on a break. */
export function useBreakPeople(dayId: string | null) {
  return useQuery({
    queryKey: ['breakPeople', dayId],
    queryFn: () => api<BoardResponse>(`/breaks/people?dayId=${dayId}`),
    enabled: dayId !== null,
    refetchInterval: REFRESH_MS,
    select: (r) => r.people,
  });
}

export function useActiveStations() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: () => api<StationsResponse>('/stations'),
    select: (r) => r.stations,
    staleTime: 60_000,
  });
}

function useBreakMutation<TBody, TResult>(fn: (body: TBody) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['breaks', 'breakPeople', 'board', 'unacked', 'duty', 'team']) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export const useAddBreak = () =>
  useBreakMutation((body: AddBreakInput) =>
    api<AddBreakResponse>('/breaks', { method: 'POST', body: JSON.stringify(body) }),
  );

export const useEditSlot = () =>
  useBreakMutation((body: EditSlotInput) =>
    api<{ updated: number }>('/breaks/slot', { method: 'PATCH', body: JSON.stringify(body) }),
  );

export const useRemoveSlot = () =>
  useBreakMutation((slot: SlotRef) =>
    api<RemovedResponse>(`/breaks/slot?${new URLSearchParams(slot).toString()}`, {
      method: 'DELETE',
    }),
  );

export const useRemoveOne = () =>
  useBreakMutation((breakId: string) =>
    api<RemovedResponse>(`/breaks/${breakId}`, { method: 'DELETE' }),
  );
