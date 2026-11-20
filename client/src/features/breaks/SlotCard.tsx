import { useState } from 'react';
import type { BreakSlot } from '@spoh/shared';
import { Button, Card, Notice, TextField } from '../../components/ui';
import { useEditSlot, useRemoveOne, useRemoveSlot } from './breaksApi';
import { CoverageWarning, isCoverageGap } from './CoverageWarning';

/** One break slot: who is in it, change its times, take people out (FR-BRK-1/2/3). */
export function SlotCard({ dayId, slot }: { dayId: string; slot: BreakSlot }) {
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [to, setTo] = useState({ start: slot.start, end: slot.end, label: slot.label });
  const edit = useEditSlot();
  const removeSlot = useRemoveSlot();
  const removeOne = useRemoveOne();
  const ref = { dayId, start: slot.start, end: slot.end, label: slot.label };
  const title = `${slot.start}–${slot.end}${slot.label ? ` · ${slot.label}` : ''}`;

  const save = (override: boolean) =>
    edit.mutate({ slot: ref, to, override }, { onSuccess: () => setEditing(false) });

  return (
    <Card role="group" aria-label={`Break ${title}`} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-base font-bold">
            {slot.start}–{slot.end}
          </div>
          <div className="text-xs text-muted">
            {slot.label || 'Break'} · {slot.people.length}{' '}
            {slot.people.length === 1 ? 'person' : 'people'}
          </div>
        </div>
        {!editing && (
          <div className="flex gap-1">
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
              Remove
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-2 rounded-btn bg-surface-2 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <TextField
              label="Start"
              type="time"
              value={to.start}
              onChange={(e) => setTo((t) => ({ ...t, start: e.target.value }))}
            />
            <TextField
              label="End"
              type="time"
              value={to.end}
              onChange={(e) => setTo((t) => ({ ...t, end: e.target.value }))}
            />
            <div className="col-span-2 sm:col-span-1">
              <TextField
                label="Label"
                value={to.label}
                onChange={(e) => setTo((t) => ({ ...t, label: e.target.value }))}
              />
            </div>
          </div>
          {isCoverageGap(edit.error) ? (
            <CoverageWarning
              error={edit.error}
              pending={edit.isPending}
              onConfirm={() => save(true)}
              onCancel={() => edit.reset()}
            />
          ) : (
            <>
              {edit.error && <Notice tone="error">{edit.error.message}</Notice>}
              <p className="text-xs text-muted">Changing the times tells everyone in this break.</p>
              <div className="flex gap-2">
                <Button disabled={edit.isPending} onClick={() => save(false)}>
                  Save
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {confirmRemove && (
        <Notice tone="warn" className="flex flex-col gap-2">
          <span>Remove this break for all {slot.people.length}? Each person is told.</span>
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={removeSlot.isPending}
              onClick={() => removeSlot.mutate(ref)}
            >
              Remove break
            </Button>
            <Button variant="secondary" onClick={() => setConfirmRemove(false)}>
              Keep
            </Button>
          </div>
        </Notice>
      )}

      <ul className="flex flex-col">
        {slot.people.map((p) => (
          <li key={p.breakId} className="flex min-h-10 items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="block text-xs text-muted">
                {p.team ?? '—'} · {p.stationName ?? 'not posted'}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Take ${p.name} off this break`}
              disabled={removeOne.isPending}
              onClick={() => removeOne.mutate(p.breakId)}
              className="grid size-9 place-items-center rounded-btn text-muted hover:bg-surface-2 hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
