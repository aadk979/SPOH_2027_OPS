import { useState } from 'react';
import { STATION_KIND_LABELS } from '@spoh/shared';
import { Button, Card, Kicker, Notice } from '../../components/ui';
import { useAdminStations } from './setupApi';
import { StationForm } from './StationForm';

/** Stations, including closed ones. Closing keeps all history; nothing is deleted. */
export function StationsSection() {
  const stations = useAdminStations();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="stations-heading">
      <div className="flex items-center justify-between">
        <h2 id="stations-heading" className="font-display text-lg font-bold">
          Stations
        </h2>
        <Button variant="secondary" onClick={() => setEditing('new')}>
          Add station
        </Button>
      </div>
      {editing === 'new' && <StationForm onDone={() => setEditing(null)} />}
      {stations.error && <Notice tone="error">{stations.error.message}</Notice>}
      {stations.data?.map((s) =>
        editing === s.id ? (
          <StationForm key={s.id} station={s} onDone={() => setEditing(null)} />
        ) : (
          <Card
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3"
            role="group"
            aria-label={s.name}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                {s.name}
                {!s.active && (
                  <span className="rounded-full bg-surface-2 px-2 text-[11px] text-muted">
                    closed
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                {[s.room || null, STATION_KIND_LABELS[s.kind], s.team].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <Kicker>Capacity</Kicker>
                <span className="font-mono text-sm">{s.capacity ?? '—'}</span>
              </div>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setEditing(s.id)}
              >
                Edit
              </Button>
            </div>
          </Card>
        ),
      )}
    </section>
  );
}
