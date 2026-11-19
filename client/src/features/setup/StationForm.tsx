import { useState, type FormEvent } from 'react';
import {
  STATION_KIND_LABELS,
  STATION_KINDS,
  type StationAdminDto,
  type StationInput,
  type StationKind,
} from '@spoh/shared';
import { Button, Notice, SelectField, TextField } from '../../components/ui';
import { fieldError } from '../../lib/fieldError';
import { useLists } from '../people/peopleApi';
import { useSaveStation } from './setupApi';

/** Add or edit a station: name, room, type, team, capacity (FR-CFG-6). */
export function StationForm({
  station,
  onDone,
}: {
  station?: StationAdminDto;
  onDone: () => void;
}) {
  const [form, setForm] = useState<StationInput>(() => ({
    name: station?.name ?? '',
    location: station?.location ?? '',
    room: station?.room ?? '',
    kind: station?.kind ?? 'staffed',
    team: station?.team ?? null,
    capacity: station?.capacity ?? null,
    sortOrder: station?.sortOrder ?? 0,
  }));
  const lists = useLists();
  const save = useSaveStation();
  const set = <K extends keyof StationInput>(key: K, value: StationInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ id: station?.id, body: form }, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={station ? 'Edit station' : 'Add station'}
      className="grid gap-3 rounded-card border border-ink bg-surface p-4 sm:grid-cols-3"
    >
      <TextField
        label="Name"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        error={fieldError(save.error, 'name')}
        required
      />
      <TextField
        label="Location"
        placeholder="e.g. AI & Analytics CoLab"
        value={form.location}
        onChange={(e) => set('location', e.target.value)}
      />
      <TextField label="Room" value={form.room} onChange={(e) => set('room', e.target.value)} />
      <SelectField
        label="Type"
        value={form.kind}
        options={STATION_KINDS.map((k) => ({ value: k, label: STATION_KIND_LABELS[k] }))}
        onChange={(e) => set('kind', e.target.value as StationKind)}
      />
      <SelectField
        label="Team"
        value={form.team ?? ''}
        placeholder="No team"
        options={(lists.data?.teams ?? []).map((t) => ({ value: t, label: t }))}
        onChange={(e) => set('team', e.target.value || null)}
      />
      <TextField
        label="Capacity (optional)"
        inputMode="numeric"
        hint="Used for busy / quiet. Leave blank for no flag."
        value={form.capacity ?? ''}
        onChange={(e) => set('capacity', e.target.value ? Number(e.target.value) : null)}
        error={fieldError(save.error, 'capacity')}
      />
      {save.error && !fieldError(save.error, 'name') && !fieldError(save.error, 'capacity') && (
        <Notice tone="error" className="sm:col-span-3">
          {save.error.message}
        </Notice>
      )}
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save station'}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        {station && (
          <Button
            variant={station.active ? 'danger' : 'secondary'}
            className="ml-auto"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { id: station.id, body: { active: !station.active } },
                { onSuccess: onDone },
              )
            }
          >
            {station.active ? 'Close station' : 'Reopen station'}
          </Button>
        )}
      </div>
    </form>
  );
}
