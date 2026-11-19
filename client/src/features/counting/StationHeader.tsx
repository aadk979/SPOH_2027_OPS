import type { ReactNode } from 'react';
import type { StationDto } from '@spoh/shared';
import { Button, Kicker } from '../../components/ui';

const KIND_KICKER: Record<StationDto['kind'], string> = {
  registration: 'Registration',
  counting: 'Counting',
  counselling: 'Counting · Counselling',
  staffed: 'Station',
};

/**
 * Always shows which station is being counted, so a shared laptop can't count for the
 * wrong room by accident (FR-FOOT-6, NFR-U-3).
 */
export function StationHeader({
  station,
  onChange,
  children,
}: {
  station: StationDto;
  onChange: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Kicker>{KIND_KICKER[station.kind]}</Kicker>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">{station.name}</h1>
          {station.room && <p className="font-mono text-xs text-muted">{station.room}</p>}
        </div>
        <Button variant="secondary" className="min-h-11 shrink-0" onClick={onChange}>
          Change station
        </Button>
      </div>
      {children}
    </div>
  );
}
