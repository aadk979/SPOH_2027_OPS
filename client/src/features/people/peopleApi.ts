import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DaysResponse,
  IssuedCodeResponse,
  ListsResponse,
  PeopleListResponse,
  PersonDto,
  PersonInput,
  PersonPatch,
} from '@spoh/shared';
import { api } from '../../lib/api';

const PEOPLE_KEY = ['people'] as const;

export function usePeople() {
  return useQuery({
    queryKey: PEOPLE_KEY,
    queryFn: () => api<PeopleListResponse>('/people'),
    select: (r) => r.people,
  });
}

export function useDays() {
  return useQuery({
    queryKey: ['days'],
    queryFn: () => api<DaysResponse>('/days'),
    select: (r) => r.days,
  });
}

export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: () => api<ListsResponse>('/config/lists'),
    staleTime: 300_000,
  });
}

export function useSavePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: PersonInput | PersonPatch }) =>
      id
        ? api<PersonDto>(`/people/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api<PersonDto>('/people', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

export function useIssueCode() {
  return useMutation({
    mutationFn: (personId: string) =>
      api<IssuedCodeResponse>(`/auth/issue-code/${personId}`, { method: 'POST' }),
  });
}

export { PEOPLE_KEY };
