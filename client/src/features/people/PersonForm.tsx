import { useState, type FormEvent } from 'react';
import {
  COURSES,
  RANK_LABELS,
  RANKS,
  type PersonDto,
  type PersonInput,
  type Rank,
} from '@spoh/shared';
import { Button, Card, Kicker, Notice, SelectField, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useDays, useLists, useSavePerson } from './peopleApi';

const needsTeam = (r: Rank) => r === 'volunteer' || r === 'ic';
const needsPortfolio = (r: Rank) => r === 'deputy' || r === 'shadow_ic';

function emptyInput(): PersonInput {
  return {
    name: '',
    email: '',
    phone: null,
    course: null,
    rank: 'volunteer',
    team: null,
    portfolio: null,
    availableDayIds: [],
  };
}

/** Add or edit one person (FR-CFG-4). Field rules mirror the server's person-rules.ts. */
export function PersonForm({ person, onDone }: { person?: PersonDto; onDone: () => void }) {
  const [form, setForm] = useState<PersonInput>(() => (person ? { ...person } : emptyInput()));
  const lists = useLists();
  const days = useDays();
  const save = useSavePerson();
  const set = <K extends keyof PersonInput>(key: K, value: PersonInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fieldError = (field: string) => {
    const details = save.error instanceof ApiError ? save.error.details : undefined;
    return Array.isArray(details)
      ? (details as { field?: string; path?: string; message: string }[]).find(
          (d) => d.field === field || d.path === field,
        )?.message
      : undefined;
  };

  const onRank = (rank: Rank) =>
    setForm((f) => ({
      ...f,
      rank,
      team: needsTeam(rank) ? f.team : null,
      portfolio: needsPortfolio(rank) ? f.portfolio : null,
    }));

  const toggleDay = (id: string) =>
    set(
      'availableDayIds',
      form.availableDayIds.includes(id)
        ? form.availableDayIds.filter((d) => d !== id)
        : [...form.availableDayIds, id],
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: person?.id, body: { ...form, phone: form.phone || null } },
      { onSuccess: onDone },
    );
  };

  const portfolioOptions = [
    ...(lists.data?.portfolios ?? []),
    ...(form.rank === 'shadow_ic' ? ['CC'] : []),
  ];

  return (
    <Card className="flex flex-col gap-4">
      <Kicker>{person ? 'Edit person' : 'Add person'}</Kicker>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={fieldError('name')}
          required
        />
        <TextField
          label="iChat email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          error={fieldError('email')}
          required
        />
        <TextField
          label="Phone (optional)"
          inputMode="tel"
          value={form.phone ?? ''}
          onChange={(e) => set('phone', e.target.value)}
          error={fieldError('phone')}
        />
        <SelectField
          label="Course"
          value={form.course ?? ''}
          placeholder="—"
          options={COURSES.map((c) => ({ value: c, label: c }))}
          onChange={(e) => set('course', (e.target.value || null) as PersonInput['course'])}
        />
        <SelectField
          label="Rank"
          value={form.rank}
          options={RANKS.map((r) => ({ value: r, label: RANK_LABELS[r] }))}
          onChange={(e) => onRank(e.target.value as Rank)}
        />
        {needsTeam(form.rank) && (
          <SelectField
            label="Team"
            value={form.team ?? ''}
            placeholder="Choose a team"
            options={(lists.data?.teams ?? []).map((t) => ({ value: t, label: t }))}
            onChange={(e) => set('team', e.target.value || null)}
            error={fieldError('team')}
          />
        )}
        {needsPortfolio(form.rank) && (
          <SelectField
            label={form.rank === 'deputy' ? 'Portfolio' : 'Shadows'}
            value={form.portfolio ?? ''}
            placeholder="Choose"
            options={portfolioOptions.map((p) => ({ value: p, label: p }))}
            onChange={(e) => set('portfolio', e.target.value || null)}
            error={fieldError('portfolio')}
          />
        )}
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-xs font-semibold text-ink-2">Available days</legend>
          <div className="flex flex-wrap gap-2">
            {(days.data ?? []).map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2 rounded-btn border border-line bg-surface-2 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.availableDayIds.includes(d.id)}
                  onChange={() => toggleDay(d.id)}
                />
                <span className="font-mono">{d.date.slice(5)}</span> {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        {save.error && !fieldError('team') && !fieldError('portfolio') && (
          <Notice tone="error" className="sm:col-span-2">
            {save.error.message}
          </Notice>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          {person && (
            <Button
              variant={person.active ? 'danger' : 'secondary'}
              className="ml-auto"
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  { id: person.id, body: { active: !person.active } },
                  { onSuccess: onDone },
                )
              }
            >
              {person.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
