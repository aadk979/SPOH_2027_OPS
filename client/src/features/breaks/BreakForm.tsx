import { useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import type { AddBreakResponse, BoardPerson, StationDto } from '@spoh/shared';
import { Button, Notice, SelectField, TextField } from '../../components/ui';
import { fieldError } from '../../lib/fieldError';
import { useAddBreak } from './breaksApi';
import { CoverageWarning, isCoverageGap } from './CoverageWarning';

type Who = 'people' | 'team' | 'station';
const WHO_LABEL: Record<Who, string> = { people: 'People', team: 'Team', station: 'Station' };

/** Add a break slot for people picked by name, by team or by station (FR-BRK-1/2). */
export function BreakForm({
  dayId,
  people,
  stations,
  teams,
  onDone,
}: {
  dayId: string;
  people: BoardPerson[];
  stations: StationDto[];
  teams: string[];
  onDone: (result: AddBreakResponse) => void;
}) {
  const [times, setTimes] = useState({ start: '12:00', end: '12:45', label: 'Lunch' });
  const [who, setWho] = useState<Who>('people');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [team, setTeam] = useState('');
  const [stationId, setStationId] = useState('');
  const [query, setQuery] = useState('');
  const add = useAddBreak();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => !q || `${p.name} ${p.team ?? ''}`.toLowerCase().includes(q));
  }, [people, query]);
  const stationName = (id: string | null) => stations.find((s) => s.id === id)?.name;

  const submit = (override: boolean) =>
    add.mutate(
      {
        dayId,
        ...times,
        personIds: who === 'people' ? [...picked] : [],
        teams: who === 'team' && team ? [team] : [],
        stationIds: who === 'station' && stationId ? [stationId] : [],
        override,
      },
      { onSuccess: onDone },
    );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(false);
  };
  const ready =
    (who === 'people' && picked.size > 0) ||
    (who === 'team' && team) ||
    (who === 'station' && stationId);
  const change = (fn: () => void) => {
    add.reset();
    fn();
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Add break"
      className="flex flex-col gap-3 rounded-card border border-ink bg-surface p-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <TextField
          label="Start"
          type="time"
          value={times.start}
          onChange={(e) => change(() => setTimes((t) => ({ ...t, start: e.target.value })))}
        />
        <TextField
          label="End"
          type="time"
          value={times.end}
          onChange={(e) => change(() => setTimes((t) => ({ ...t, end: e.target.value })))}
          error={fieldError(add.error, 'end')}
        />
        <div className="col-span-2 sm:col-span-1">
          <TextField
            label="Label"
            placeholder="e.g. Lunch"
            value={times.label}
            onChange={(e) => setTimes((t) => ({ ...t, label: e.target.value }))}
          />
        </div>
      </div>

      <div role="radiogroup" aria-label="Who" className="flex gap-1 rounded-btn bg-surface-2 p-1">
        {(Object.keys(WHO_LABEL) as Who[]).map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={who === w}
            onClick={() => change(() => setWho(w))}
            className={clsx(
              'flex-1 rounded-btn px-3 py-2 text-sm font-semibold',
              who === w ? 'bg-surface text-ink shadow-sm' : 'text-muted',
            )}
          >
            {WHO_LABEL[w]}
          </button>
        ))}
      </div>

      {who === 'people' && (
        <div className="flex flex-col gap-2">
          <TextField
            label="Search people"
            placeholder="Name or team"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul
            className="max-h-72 overflow-y-auto rounded-btn border border-line"
            aria-label="People"
          >
            {shown.map((p) => (
              <li key={p.id} className="border-b border-line last:border-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={() =>
                      change(() =>
                        setPicked((s) => {
                          const next = new Set(s);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        }),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {p.team ?? '—'} · {stationName(p.stationId) ?? 'not posted'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {who === 'team' && (
        <SelectField
          label="Team"
          value={team}
          placeholder="Choose a team"
          options={teams.map((t) => ({ value: t, label: t }))}
          onChange={(e) => change(() => setTeam(e.target.value))}
        />
      )}
      {who === 'station' && (
        <SelectField
          label="Station"
          value={stationId}
          placeholder="Choose a station"
          options={stations.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(e) => change(() => setStationId(e.target.value))}
        />
      )}

      {isCoverageGap(add.error) ? (
        <CoverageWarning
          error={add.error}
          pending={add.isPending}
          onConfirm={() => submit(true)}
          onCancel={() => add.reset()}
        />
      ) : (
        <>
          {add.error && !fieldError(add.error, 'end') && (
            <Notice tone="error">{add.error.message}</Notice>
          )}
          <p className="text-xs text-muted">Each person is told on My Duty and by email.</p>
          <Button type="submit" disabled={!ready || add.isPending}>
            {add.isPending
              ? 'Saving…'
              : who === 'people'
                ? `Add break for ${picked.size}`
                : 'Add break'}
          </Button>
        </>
      )}
    </form>
  );
}
