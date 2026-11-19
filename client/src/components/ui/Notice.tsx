import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'ok' | 'error' | 'warn' | 'info';

const TONES: Record<Tone, string> = {
  ok: 'border-ok/30 bg-ok-bg text-ok',
  error: 'border-busy/30 bg-busy-bg text-busy',
  warn: 'border-low/30 bg-low-bg text-low',
  info: 'border-line bg-surface-2 text-ink-2',
};

/** Inline message box. Errors are announced to screen readers. */
export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx('rounded-btn border px-3 py-2.5 text-sm', TONES[tone], className)}
    >
      {children}
    </div>
  );
}
