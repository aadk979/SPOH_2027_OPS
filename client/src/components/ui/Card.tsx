import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

/** Flat surface with a hairline border — the basic container of the Clean Lab style. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-card border border-line bg-surface px-4 py-3.5', className)}
      {...rest}
    />
  );
}
