import { useState } from 'react';
import { Card, CountChip, DayTabs, Notice, PageHeader } from '../../components/ui';
import { timeAgo } from '../../lib/timeAgo';
import { useDays } from '../people/peopleApi';
import { useTeam } from '../duty/dutyApi';

/**
 * Wireframe A8: the IC's own team for a day, with contact details (FR-DUTY-10).
 * ICs can't move people (FR-DUTY-9); the server enforces that too.
 */
export function TeamPage() {
  const days = useDays();
  const [dayId, setDayId] = useState<string | null>(null);
  const team = useTeam(dayId);
  const data = team.data;
  const rostered = data?.members.filter((m) => m.available).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="My team"
        subtitle={data?.team ? `${data.team} · ${rostered} rostered` : undefined}
      />
      {days.data && days.data.length > 1 && (
        <DayTabs days={days.data} value={dayId ?? data?.day?.id ?? null} onChange={setDayId} />
      )}
      {team.error && <Notice tone="error">{team.error.message}</Notice>}
      {data && !data.team && <Notice>You are not in a team, so there is no one to show.</Notice>}
      <ul className="flex flex-col gap-2">
        {data?.members.map((m) => (
          <li key={m.id}>
            <Card className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{m.name}</div>
                <div className="truncate text-xs text-muted">
                  {m.phone ? (
                    <a className="font-mono underline" href={`tel:${m.phone}`}>
                      {m.phone}
                    </a>
                  ) : (
                    '—'
                  )}{' '}
                  ·{' '}
                  <a className="underline" href={`mailto:${m.email}`}>
                    {m.email}
                  </a>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-right text-sm">
                <span className="font-semibold">
                  {m.station?.name ?? (m.available ? 'Not posted' : 'Not rostered')}
                </span>
                {m.unacked > 0 && m.oldestUnackedAt && (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <CountChip
                      count={m.unacked}
                      one="not acknowledged"
                      many="not acknowledged"
                      tone="error"
                    />
                    {timeAgo(m.oldestUnackedAt)}
                  </span>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">ICs can&apos;t move people. Ask your Deputy.</p>
    </div>
  );
}
