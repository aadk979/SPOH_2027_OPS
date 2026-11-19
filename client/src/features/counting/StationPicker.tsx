import clsx from 'clsx';
import type { StationDto } from '@spoh/shared';
import { Button, Kicker, PageHeader } from '../../components/ui';

const KIND_LABEL: Record<StationDto['kind'], string> = {
  registration: 'Registration',
  counting: 'Room count',
  counselling: 'Guided / walk-in',
  staffed: 'Staffed',
};

/**
 * Pick the station this device counts for. The choice is remembered on this device
 * (FR-FOOT-1), not taken from the signed-in account, because laptops are shared (T4).
 */
export function StationPicker({
  stations,
  currentId,
  onPick,
  onCancel,
}: {
  stations: StationDto[];
  currentId: string | null;
  onPick: (station: StationDto) => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Where are you counting?"
        subtitle="This device will remember your choice."
        actions={
          onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )
        }
      />
      {stations.length === 0 ? (
        <p className="text-sm text-muted">No counting stations are set up. Ask an Admin.</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {stations.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                aria-current={s.id === currentId ? 'true' : undefined}
                className={clsx(
                  'flex h-full min-h-16 w-full items-center justify-between gap-3 rounded-card border bg-surface px-4 py-3 text-left',
                  'transition-transform duration-150 ease-out active:scale-[0.98]',
                  s.id === currentId ? 'border-ink' : 'border-line hover:border-ink-2',
                )}
              >
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold">{s.name}</span>
                  {s.room && <span className="font-mono text-xs text-muted">{s.room}</span>}
                </span>
                <Kicker className="shrink-0">{KIND_LABEL[s.kind]}</Kicker>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
