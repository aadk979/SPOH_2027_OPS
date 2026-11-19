import clsx from 'clsx';
import { formatDayShort, type EventDayDto } from '@spoh/shared';

/** A row of day chips ("Thu 7 Jan"). Today, if it is an event day, is marked. */
export function DayTabs({
  days,
  value,
  onChange,
  todayId,
}: {
  days: readonly EventDayDto[];
  value: string | null;
  onChange: (id: string) => void;
  todayId?: string | null;
}) {
  return (
    <div role="tablist" aria-label="Event day" className="flex flex-wrap gap-1.5">
      {days.map((d) => (
        <button
          key={d.id}
          type="button"
          role="tab"
          aria-selected={d.id === value}
          onClick={() => onChange(d.id)}
          className={clsx(
            'rounded-full border px-3 py-1.5 text-sm font-semibold',
            d.id === value ? 'border-ink bg-ink text-page' : 'border-line bg-surface text-ink-2',
          )}
        >
          {formatDayShort(d.date)}
          {d.id === todayId && <span className="ml-1 font-mono text-[10px]">TODAY</span>}
        </button>
      ))}
    </div>
  );
}
