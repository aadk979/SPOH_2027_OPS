import { useState, type FormEvent } from 'react';
import { FOOTFALL_MAX_COUNT } from '@spoh/shared';
import { Button, TextField } from '../../components/ui';

/** "+n": count a whole group in one tap (FR-FOOT-1). */
export function GroupCountForm({
  title,
  onAdd,
  onCancel,
}: {
  title: string;
  onAdd: (count: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= FOOTFALL_MAX_COUNT;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onAdd(n);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <TextField
        label={title}
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
        hint={`1 to ${FOOTFALL_MAX_COUNT} people`}
        className="font-mono text-2xl"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="min-h-16" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="hero" className="min-h-16 text-base" disabled={!valid}>
          {valid ? `Add ${n}` : 'Add'}
        </Button>
      </div>
    </form>
  );
}
