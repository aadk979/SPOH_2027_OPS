import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RosterCommitResponse, RosterPreviewResponse } from '@spoh/shared';
import { api, apiText } from '../../lib/api';
import { PEOPLE_KEY } from '../people/peopleApi';

export function usePreviewRoster() {
  return useMutation({
    mutationFn: (csv: string) =>
      api<RosterPreviewResponse>('/roster/preview', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
  });
}

export function useCommitRoster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      api<RosterCommitResponse>('/roster/commit', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

export function useDeactivate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deactivated: number }>('/roster/deactivate', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEOPLE_KEY }),
  });
}

/** Downloads the template (needs the auth header, so it can't be a plain link). */
export async function downloadTemplate() {
  const text = await apiText('/roster/template.csv');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: 'spoh-roster-template.csv',
  });
  a.click();
  URL.revokeObjectURL(url);
}
