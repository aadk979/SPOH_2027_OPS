import { useState } from 'react';
import type { StationDto } from '@spoh/shared';
import { Kicker, Notice, TapPad } from '../../components/ui';
import { CaptureFeedback } from './CaptureFeedback';
import { GroupCountForm } from './GroupCountForm';
import { StationHeader } from './StationHeader';
import { useFootfallCapture } from './useFootfallCapture';

const QUICK_GROUPS = [2, 3, 4] as const;

/** Wireframe A5: a big +1 for each person entering, quick +2/+3/+4, and +n (FR-FOOT-1). */
export function FootfallScreen({
  station,
  onChangeStation,
}: {
  station: StationDto;
  onChangeStation: () => void;
}) {
  const { summary, capture, add, totals } = useFootfallCapture(station);
  const [askGroup, setAskGroup] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <StationHeader station={station} onChange={onChangeStation}>
        <div className="rounded-card border border-line bg-surface px-4 py-4 text-center">
          <Kicker>Entered today</Kicker>
          <div
            className="mt-1 font-mono text-6xl font-bold tracking-tight"
            data-testid="station-total"
          >
            {totals?.total ?? '–'}
          </div>
          <p className="text-xs text-muted">
            <span className="font-mono" data-testid="device-total">
              {totals?.device ?? '–'}
            </span>{' '}
            on this device
          </p>
        </div>
      </StationHeader>

      {summary.isError && (
        <Notice tone="warn">Couldn't load today's total. Taps still save.</Notice>
      )}

      {askGroup ? (
        <GroupCountForm
          title="How many people in the group?"
          onCancel={() => setAskGroup(false)}
          onAdd={(n) => {
            add('entry', n, `+${n}`);
            setAskGroup(false);
          }}
        />
      ) : (
        <>
          <TapPad aria-label="Add one person" onClick={() => add('entry', 1, '+1')}>
            +1
          </TapPad>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_GROUPS.map((n) => (
              <TapPad
                key={n}
                size="small"
                tone="surface"
                aria-label={`Add ${n} people`}
                onClick={() => add('entry', n, `+${n}`)}
              >
                +{n}
              </TapPad>
            ))}
            <TapPad size="small" tone="surface" onClick={() => setAskGroup(true)}>
              +n
            </TapPad>
          </div>
        </>
      )}

      <CaptureFeedback capture={capture} />
    </div>
  );
}
