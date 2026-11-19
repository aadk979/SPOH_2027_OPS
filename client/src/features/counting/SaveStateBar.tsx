import { useEffect, useState } from 'react';
import { Button, Notice } from '../../components/ui';
import type { TapJob } from './tapQueue';

/** A tap counts as "not saved" once it has been pending this long (design system SaveState). */
const SHOW_AFTER_MS = 2_000;

/**
 * Hidden while taps save normally. Shows a red "Not saved, retrying…" bar when any tap has
 * been pending for over 2 s (FR-REG-7), and lists taps a retry cannot fix.
 */
export function SaveStateBar<P>({
  pending,
  failed,
  onCancel,
  onDismiss,
}: {
  pending: TapJob<P>[];
  failed: TapJob<P>[];
  onCancel: () => void;
  onDismiss: (id: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const anyPending = pending.length > 0;
  useEffect(() => {
    if (!anyPending) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [anyPending]);

  const stuck = pending.filter((j) => now - j.createdAt > SHOW_AFTER_MS);
  const people = stuck.reduce((n, j) => n + j.people, 0);

  return (
    <>
      {stuck.length > 0 && (
        <div
          role="alert"
          className="flex min-h-14 items-center justify-between gap-3 rounded-btn border-2 border-busy bg-busy-bg pl-3 text-sm font-semibold text-busy"
        >
          <span>
            ⚠ Not saved, retrying… <span className="font-mono">({people})</span>
          </span>
          <button type="button" className="min-h-14 px-4 font-bold underline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
      {failed.map((job) => (
        <Notice key={job.id} tone="error" className="flex items-center justify-between gap-3">
          <span>
            Not saved: {job.label}. {job.error}
          </span>
          <Button variant="secondary" className="shrink-0" onClick={() => onDismiss(job.id)}>
            Dismiss
          </Button>
        </Notice>
      ))}
    </>
  );
}
