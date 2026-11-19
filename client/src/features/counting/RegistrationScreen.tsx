import { useState } from 'react';
import { REG_CATEGORIES, REG_CATEGORY_LABELS } from '@spoh/shared';
import type { RegCategory, StationDto } from '@spoh/shared';
import { Button, Notice, TapPad } from '../../components/ui';
import { CaptureFeedback, pendingPeople } from './CaptureFeedback';
import { getDeviceId, newId } from './device';
import { FamilyStepper, type FamilyCounts } from './FamilyStepper';
import {
  applyRegistration,
  registrationQueue,
  registrationSummaryKey,
  undoRegistration,
  useRegistrationSummary,
  type RegistrationPayload,
} from './registrationApi';
import { StationHeader } from './StationHeader';
import { useCountCapture } from './useCountCapture';

const TILE_LABELS: Partial<Record<RegCategory, string>> = {
  graduated: 'Graduated, awaiting results',
};

/**
 * Wireframe A3: one tap = one anonymous visitor (FR-REG-1). Shows this station's and this
 * device's totals for today (FR-REG-4). No visitor details are ever asked for (Rule 2).
 */
export function RegistrationScreen({
  station,
  onChangeStation,
}: {
  station: StationDto;
  onChangeStation: () => void;
}) {
  const summary = useRegistrationSummary(station.id);
  const capture = useCountCapture({
    queue: registrationQueue,
    stationId: station.id,
    summaryKey: registrationSummaryKey,
    apply: applyRegistration,
    undo: undoRegistration,
  });
  const [familyMode, setFamilyMode] = useState(false);

  const record = (records: RegistrationPayload['records'], groupId: string | null, label: string) =>
    capture.record({
      id: records[0]!.clientId,
      payload: { stationId: station.id, deviceId: getDeviceId(), groupId, records },
      people: records.length,
      label,
    });

  const tap = (category: RegCategory) =>
    record([{ clientId: newId(), category }], null, REG_CATEGORY_LABELS[category]);

  const confirmFamily = (counts: FamilyCounts) => {
    const records = REG_CATEGORIES.flatMap((category) =>
      Array.from({ length: counts[category] }, () => ({ clientId: newId(), category })),
    );
    record(records, newId(), `family of ${records.length}`);
    setFamilyMode(false);
  };

  if (familyMode) {
    return (
      <FamilyStepper
        stationName={station.name}
        onConfirm={confirmFamily}
        onBack={() => setFamilyMode(false)}
      />
    );
  }

  const waiting = pendingPeople(capture);
  const show = (n: number | undefined) => (n === undefined ? '–' : n + waiting);

  return (
    <div className="flex flex-col gap-4">
      <StationHeader station={station} onChange={onChangeStation}>
        <div className="flex items-end justify-between rounded-card border border-line bg-surface px-4 py-3">
          <div>
            <span
              className="font-mono text-5xl font-bold tracking-tight"
              data-testid="station-total"
            >
              {show(summary.data?.total)}
            </span>
            <span className="ml-2 text-sm text-muted">registered here today</span>
          </div>
          <div className="text-right text-sm text-muted">
            <span className="font-mono font-bold text-ink" data-testid="device-total">
              {show(summary.data?.device)}
            </span>{' '}
            this device
          </div>
        </div>
      </StationHeader>

      {summary.isError && (
        <Notice tone="warn">Couldn't load today's total. Taps still save.</Notice>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {REG_CATEGORIES.map((c) => (
          <TapPad key={c} size="tile" tone="surface" onClick={() => tap(c)}>
            {TILE_LABELS[c] ?? REG_CATEGORY_LABELS[c]}
          </TapPad>
        ))}
      </div>

      <CaptureFeedback capture={capture} />

      <Button
        variant="secondary"
        className="min-h-16 text-base"
        onClick={() => setFamilyMode(true)}
      >
        A family arriving together
      </Button>
    </div>
  );
}
