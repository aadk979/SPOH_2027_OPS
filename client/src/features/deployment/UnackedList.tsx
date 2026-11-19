import { useState } from 'react';
import type { StationAdminDto } from '@spoh/shared';
import { Card, Notice, SelectField } from '../../components/ui';
import { timeAgo } from '../../lib/timeAgo';
import { useLists } from '../people/peopleApi';
import { useUnacked } from './deploymentApi';

/** Changes nobody has tapped "Got it" on: who, what, how long ago (FR-DUTY-8). */
export function UnackedList({ stations }: { stations: StationAdminDto[] }) {
  const [filter, setFilter] = useState({ stationId: '', team: '' });
  const lists = useLists();
  const changes = useUnacked(filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Station"
          value={filter.stationId}
          placeholder="All stations"
          options={stations.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(e) => setFilter((f) => ({ ...f, stationId: e.target.value }))}
        />
        <SelectField
          label="Team"
          value={filter.team}
          placeholder="All teams"
          options={(lists.data?.teams ?? []).map((t) => ({ value: t, label: t }))}
          onChange={(e) => setFilter((f) => ({ ...f, team: e.target.value }))}
        />
      </div>
      {changes.error && <Notice tone="error">{changes.error.message}</Notice>}
      {changes.data?.length === 0 && (
        <Notice tone="ok">Everyone has acknowledged their changes.</Notice>
      )}
      <ul className="flex flex-col gap-2" aria-label="Unacknowledged changes">
        {changes.data?.map((c) => (
          <li key={c.id}>
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-ink-2">{c.summary}</div>
              </div>
              <div className="text-right text-xs text-muted">
                <div>{c.team ?? '—'}</div>
                <div className="font-mono text-busy">{timeAgo(c.createdAt)}</div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
