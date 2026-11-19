import { useState } from 'react';
import {
  formatDayShort,
  type AssignResponse,
  type EventDayDto,
  type NotAvailableDetails,
  type StationAdminDto,
} from '@spoh/shared';
import { Button, Card, Kicker, Notice, SelectField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useAssign } from './deploymentApi';

/**
 * Wireframe B2 "Move n people": station → effective time → days → confirm (FR-DUTY-2/3/4).
 * If anyone isn't available, the server answers 409 and the Admin may assign anyway.
 */
export function MovePanel({
  personIds,
  stations,
  days,
  dayId,
  onDone,
}: {
  personIds: string[];
  stations: StationAdminDto[];
  days: EventDayDto[];
  dayId: string;
  onDone: (result: AssignResponse) => void;
}) {
  const [stationId, setStationId] = useState('');
  const [mode, setMode] = useState<'now' | 'time'>('now');
  const [time, setTime] = useState('13:00');
  const [dayIds, setDayIds] = useState<string[]>([dayId]);
  const assign = useAssign();

  const notAvailable =
    assign.error instanceof ApiError && assign.error.code === 'NOT_AVAILABLE'
      ? (assign.error.details as NotAvailableDetails)
      : null;

  const submit = (override: boolean) =>
    assign.mutate(
      { personIds, stationId, dayIds, from: mode === 'now' ? 'now' : time, override },
      { onSuccess: onDone },
    );

  const toggleDay = (id: string) => {
    assign.reset();
    setDayIds((ids) => (ids.includes(id) ? ids.filter((d) => d !== id) : [...ids, id]));
  };

  const n = personIds.length;
  return (
    <Card className="flex flex-col gap-3 border-ink" role="group" aria-label="Move people">
      <Kicker>
        Move {n} {n === 1 ? 'person' : 'people'}
      </Kicker>
      <SelectField
        label="To station"
        value={stationId}
        placeholder="Choose a station"
        options={stations.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
        onChange={(e) => {
          assign.reset();
          setStationId(e.target.value);
        }}
      />
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="mb-1.5 text-xs font-semibold text-ink-2">Effective</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} />
          Now <span className="text-muted">(start of day if it hasn&apos;t begun)</span>
        </label>
        <span className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === 'time'} onChange={() => setMode('time')} />
            From
          </label>
          <input
            type="time"
            aria-label="From time"
            value={time}
            disabled={mode !== 'time'}
            onChange={(e) => setTime(e.target.value)}
            className="w-36 rounded-btn border border-line bg-surface px-3 py-2 font-mono text-sm text-ink disabled:opacity-60"
          />
        </span>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-ink-2">Days</legend>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-2 rounded-btn border border-line bg-surface-2 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={dayIds.includes(d.id)}
                onChange={() => toggleDay(d.id)}
              />
              {formatDayShort(d.date)}
            </label>
          ))}
        </div>
      </fieldset>

      {notAvailable ? (
        <Notice tone="warn" className="flex flex-col gap-2">
          <span>
            {notAvailable.map((x) => `${x.name} is not available on ${x.day}.`).join(' ')} Assign
            anyway?
          </span>
          <div className="flex gap-2">
            <Button disabled={assign.isPending} onClick={() => submit(true)}>
              Assign anyway
            </Button>
            <Button variant="secondary" onClick={() => assign.reset()}>
              Change
            </Button>
          </div>
        </Notice>
      ) : (
        <>
          {assign.error && <Notice tone="error">{assign.error.message}</Notice>}
          <p className="text-xs text-muted">
            They&apos;ll see the change on My Duty and must tap &quot;Got it&quot;.
          </p>
          <Button
            disabled={!stationId || dayIds.length === 0 || assign.isPending}
            onClick={() => submit(false)}
          >
            {assign.isPending ? 'Saving…' : 'Confirm move'}
          </Button>
        </>
      )}
    </Card>
  );
}
