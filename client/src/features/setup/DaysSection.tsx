import { useState } from 'react';
import { formatDayShort, type EventDayDto } from '@spoh/shared';
import { Button, Card, Kicker, Notice } from '../../components/ui';
import { useDays } from '../people/peopleApi';
import { DayForm } from './DayForm';
import { useDayImpact, useDeleteDay } from './setupApi';

/** Shows what removing a day touches and asks for confirmation (FR-CFG-5a). */
function RemoveDay({ day, onDone }: { day: EventDayDto; onDone: () => void }) {
  const impact = useDayImpact(day.id);
  const remove = useDeleteDay();
  const i = impact.data;
  return (
    <Notice tone="warn" className="flex flex-col gap-2">
      <b>Remove {formatDayShort(day.date)}?</b>
      {impact.isPending && <span>Checking what this day has…</span>}
      {i && (
        <ul className="list-inside list-disc text-ink-2">
          <li>
            {i.assignments} posts, {i.breaks} breaks and {i.dutyChanges} duty changes will be
            deleted.
          </li>
          <li>{i.availablePeople} people lose this day from their availability.</li>
          <li>
            Kept: {i.registrationsKept} registrations and {i.footfallKept} room entries recorded on
            this date. Reports can still find them.
          </li>
        </ul>
      )}
      {remove.error && <span className="text-busy">{remove.error.message}</span>}
      <div className="flex gap-2">
        <Button
          variant="danger"
          disabled={!i || remove.isPending}
          onClick={() => remove.mutate(day.id, { onSuccess: onDone })}
        >
          Remove day
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Keep it
        </Button>
      </div>
    </Notice>
  );
}

/** Event days: add, edit, remove. Nothing is hard-wired to the real dates (FR-CFG-5). */
export function DaysSection() {
  const days = useDays();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="days-heading">
      <div className="flex items-center justify-between">
        <h2 id="days-heading" className="font-display text-lg font-bold">
          Event days
        </h2>
        <Button variant="secondary" onClick={() => setEditing('new')}>
          Add day
        </Button>
      </div>
      {editing === 'new' && <DayForm onDone={() => setEditing(null)} />}
      {days.error && <Notice tone="error">{days.error.message}</Notice>}
      {days.data?.length === 0 && <Notice>No event days yet. Add one to start planning.</Notice>}
      {days.data?.map((d) =>
        editing === d.id ? (
          <DayForm key={d.id} day={d} onDone={() => setEditing(null)} />
        ) : (
          <Card key={d.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {formatDayShort(d.date)}{' '}
                  <span className="font-mono text-xs text-muted">{d.date}</span>
                </div>
                <div className="text-sm text-muted">{d.label || 'No label'}</div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <Kicker>Report</Kicker>
                  <span className="font-mono text-sm">{d.reportTime ?? '—'}</span>
                </div>
                <div>
                  <Kicker>Dismiss</Kicker>
                  <span className="font-mono text-sm">{d.dismissTime ?? '—'}</span>
                </div>
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setEditing(d.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setRemoving(d.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
            {removing === d.id && <RemoveDay day={d} onDone={() => setRemoving(null)} />}
          </Card>
        ),
      )}
    </section>
  );
}
