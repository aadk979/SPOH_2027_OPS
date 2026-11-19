import { useEffect, useState, type FormEvent } from 'react';
import type { Thresholds } from '@spoh/shared';
import { Button, Card, Notice, TextField } from '../../components/ui';
import { fieldError } from '../../lib/fieldError';
import { useSaveThresholds, useThresholds } from './setupApi';

const FIELDS: { key: keyof Thresholds; label: string; hint: string }[] = [
  { key: 'busyWindowMin', label: 'Window (minutes)', hint: 'Entries counted over this period.' },
  { key: 'busyPct', label: 'Busy above (%)', hint: 'Of the room capacity.' },
  { key: 'quietPct', label: 'Quiet below (%)', hint: 'Must be lower than busy.' },
  { key: 'lowStockPct', label: 'Gift stock low at (%)', hint: 'Of starting stock + restocks.' },
];

/** Busy/quiet thresholds and the low-stock level (FR-DASH-3, FR-GIFT-3). */
export function ThresholdsSection() {
  const current = useThresholds();
  const save = useSaveThresholds();
  const [form, setForm] = useState<Thresholds | null>(null);
  useEffect(() => {
    if (current.data && !form) setForm(current.data);
  }, [current.data, form]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form) save.mutate(form);
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="thresholds-heading">
      <h2 id="thresholds-heading" className="font-display text-lg font-bold">
        Thresholds
      </h2>
      {current.error && <Notice tone="error">{current.error.message}</Notice>}
      {form && (
        <Card>
          <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-4">
            {FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                hint={f.hint}
                inputMode="numeric"
                value={String(form[f.key])}
                error={fieldError(save.error, f.key)}
                onChange={(e) => {
                  setForm({ ...form, [f.key]: Number(e.target.value.replace(/\D/g, '')) });
                  save.reset();
                }}
              />
            ))}
            <div className="flex items-center gap-3 sm:col-span-4">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save thresholds'}
              </Button>
              {save.isSuccess && <span className="text-sm text-ok">✓ Saved</span>}
              {save.error && !FIELDS.some((f) => fieldError(save.error, f.key)) && (
                <span className="text-sm text-busy">{save.error.message}</span>
              )}
            </div>
          </form>
        </Card>
      )}
    </section>
  );
}
