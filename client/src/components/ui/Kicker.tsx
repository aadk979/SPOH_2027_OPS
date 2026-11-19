import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

/** Small monospace uppercase label that sits above a value. */
export function Kicker({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        'block font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted',
        className,
      )}
      {...rest}
    />
  );
}
