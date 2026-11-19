import { useState, type FormEvent } from 'react';
import type { DayInput, EventDayDto } from '@spoh/shared';
import { Button, Notice, TextField } from '../../components/ui';
import { fieldError } from '../../lib/fieldError';
import { useSaveDay } from './setupApi';

/** Add or edit one event day: date, label, report and dismissal time (FR-CFG-5/5b). */
export function DayForm({ day, onDone }: { day?: EventDayDto; onDone: () => void }) {
  const [form, setForm] = useState<DayInput>(() => ({
    date: day?.date ?? '',
    label: day?.label ?? '',
    reportTime: day?.reportTime ?? null,
    dismissTime: day?.dismissTime ?? null,
  }));
  const save = useSaveDay();
  const set = <K extends keyof DayInput>(key: K, value: DayInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const timesChanged =
    day && (form.reportTime !== day.reportTime || form.dismissTime !== day.dismissTime);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ id: day?.id, body: form }, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-3 rounded-card border border-ink bg-surface p-4 sm:grid-cols-4"
      aria-label={day ? 'Edit day' : 'Add day'}
    >
      <TextField
        label="Date"
        type="date"
        value={form.date}
        onChange={(e) => set('date', e.target.value)}
        error={fieldError(save.error, 'date')}
        required
      />
      <TextField
        label="Label"
        placeholder="e.g. Open House Day 1"
        value={form.label}
        onChange={(e) => set('label', e.target.value)}
      />
      <TextField
        label="Report time"
        type="time"
        value={form.reportTime ?? ''}
        onChange={(e) => set('reportTime', e.target.value || null)}
        error={fieldError(save.error, 'reportTime')}
      />
      <TextField
        label="Dismissal time"
        type="time"
        value={form.dismissTime ?? ''}
        onChange={(e) => set('dismissTime', e.target.value || null)}
        error={fieldError(save.error, 'dismissTime')}
      />
      {timesChanged && (
        <Notice tone="warn" className="sm:col-span-4">
          Everyone posted on this day will be asked to tap &quot;Got it&quot; for the new times.
        </Notice>
      )}
      {save.error && !fieldError(save.error, 'date') && (
        <Notice tone="error" className="sm:col-span-4">
          {save.error.message}
        </Notice>
      )}
      <div className="flex gap-2 sm:col-span-4">
        <Button type="submit" disabled={save.isPending || !form.date}>
          {save.isPending ? 'Saving…' : 'Save day'}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
