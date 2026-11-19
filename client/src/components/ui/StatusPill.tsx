import clsx from 'clsx';
import type { ReactNode } from 'react';

export type Status = 'busy' | 'quiet' | 'ok' | 'low';

const STYLES: Record<Status, string> = {
  busy: 'bg-busy-bg text-busy',
  quiet: 'bg-quiet-bg text-quiet',
  ok: 'bg-ok-bg text-ok',
  low: 'bg-low-bg text-low',
};

const WORDS: Record<Status, string> = { busy: 'BUSY', quiet: 'QUIET', ok: 'OK', low: 'LOW' };

/** Status is never shown by colour alone: the pill always carries a word. */
export function StatusPill({ status, children }: { status: Status; children?: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-wide',
        STYLES[status],
      )}
    >
      {WORDS[status]}
      {children && <span className="font-semibold">· {children}</span>}
    </span>
  );
}
