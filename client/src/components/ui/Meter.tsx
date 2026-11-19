import clsx from 'clsx';
import type { Status } from './StatusPill';

export interface MeterProps {
  /** 0–100; values outside are clamped. */
  percent: number;
  status?: Extract<Status, 'busy' | 'quiet' | 'ok'>;
  label?: string;
}

/** Neutral progress bar; only turns red/blue when a room is busy/quiet (red is reserved). */
export function Meter({ percent, status = 'ok', label }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-[7px] overflow-hidden rounded-full bg-track"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <div
        className={clsx(
          'h-full rounded-full',
          status === 'busy' ? 'bg-busy' : status === 'quiet' ? 'bg-quiet' : 'bg-meter',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
