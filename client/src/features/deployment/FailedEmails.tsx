import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FailedEmailsResponse, RetryEmailResponse } from '@spoh/shared';
import { Button, Card, Kicker } from '../../components/ui';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/timeAgo';

export function useFailedEmails() {
  return useQuery({
    queryKey: ['failedEmails'],
    queryFn: () => api<FailedEmailsResponse>('/notifications/failed'),
    refetchInterval: 30_000,
  });
}

function useRetry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) =>
      api<RetryEmailResponse>('/notifications/retry', {
        method: 'POST',
        body: JSON.stringify({ personId }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['failedEmails'] }),
  });
}

/**
 * Duty emails that failed after 3 attempts (FR-NOTIF-3). The change is still on the
 * person's My Duty; the Admin can retry or tell them another way.
 */
export function FailedEmails() {
  const failed = useFailedEmails();
  const retry = useRetry();
  const rows = failed.data?.failed ?? [];
  if (rows.length === 0) return null;

  return (
    <Card
      role="region"
      aria-label="Emails not delivered"
      className="flex flex-col gap-2 border-busy"
    >
      <Kicker>Emails not delivered ({rows.length})</Kicker>
      <p className="text-xs text-muted">
        These people still see the change on My Duty. Retry, or tell them another way. If their
        email is not arriving, People → Login code signs them in.
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.personId} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold">{r.name}</div>
              <div className="truncate text-xs text-muted">
                {r.email} · {r.changes} {r.changes === 1 ? 'change' : 'changes'}
                {r.lastTriedAt && ` · ${timeAgo(r.lastTriedAt)}`}
              </div>
              {r.lastError && (
                <div className="truncate font-mono text-[11px] text-busy">{r.lastError}</div>
              )}
            </div>
            <Button
              variant="secondary"
              disabled={retry.isPending}
              onClick={() => retry.mutate(r.personId)}
            >
              Retry
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
