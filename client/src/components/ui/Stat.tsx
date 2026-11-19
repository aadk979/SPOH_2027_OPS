import type { ReactNode } from 'react';
import { Card } from './Card';
import { Kicker } from './Kicker';

export interface StatProps {
  label: string;
  value: ReactNode;
  /** Smaller text after the value, e.g. "/ 94". */
  suffix?: ReactNode;
  footer?: ReactNode;
}

/** A labelled number. Numbers are always monospace (design principle 3). */
export function Stat({ label, value, suffix, footer }: StatProps) {
  return (
    <Card>
      <Kicker>{label}</Kicker>
      <div className="mt-1.5 font-mono text-3xl font-bold tracking-tight">
        {value}
        {suffix !== undefined && (
          <span className="ml-1 text-sm font-semibold text-muted">{suffix}</span>
        )}
      </div>
      {footer && <div className="mt-1 text-xs text-muted">{footer}</div>}
    </Card>
  );
}
