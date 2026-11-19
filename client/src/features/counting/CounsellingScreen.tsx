import clsx from 'clsx';
import { useState } from 'react';
import { COUNSELLING_COURSES, FOOTFALL_VARIANT_LABELS } from '@spoh/shared';
import type { CounsellingCourse, StationDto } from '@spoh/shared';
import { Button, Card, Kicker, Notice, TapPad } from '../../components/ui';
import { CaptureFeedback } from './CaptureFeedback';
import { GroupCountForm } from './GroupCountForm';
import { StationHeader } from './StationHeader';
import { useFootfallCapture } from './useFootfallCapture';

type Variant = 'guided' | 'walk_in';

/**
 * Wireframe A6: the Counselling Room counts guided-group members and counselling-only
 * walk-ins separately (FR-FOOT-3). A course tag is optional and applies to the next tap
 * only, so nobody is ever forced to pick one (FR-FOOT-4).
 */
export function CounsellingScreen({
  station,
  onChangeStation,
}: {
  station: StationDto;
  onChangeStation: () => void;
}) {
  const { summary, capture, add, totals } = useFootfallCapture(station);
  const [course, setCourse] = useState<CounsellingCourse | null>(null);
  const [askGroup, setAskGroup] = useState<Variant | null>(null);

  const tap = (variant: Variant, count: number) => {
    const name = variant === 'guided' ? 'Guided' : 'Walk-in';
    const label = `${count === 1 ? name : `${name} +${count}`}${course ? ` · ${course}` : ''}`;
    add(variant, count, label, course);
    setCourse(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <StationHeader station={station} onChange={onChangeStation}>
        <div className="grid grid-cols-2 gap-2.5">
          <Card className="text-center">
            <Kicker>Guided</Kicker>
            <div className="font-mono text-4xl font-bold" data-testid="guided-total">
              {totals?.guided ?? '–'}
            </div>
          </Card>
          <Card className="text-center">
            <Kicker>Walk-in</Kicker>
            <div className="font-mono text-4xl font-bold" data-testid="walkin-total">
              {totals?.walk_in ?? '–'}
            </div>
          </Card>
        </div>
      </StationHeader>

      {summary.isError && (
        <Notice tone="warn">Couldn't load today's totals. Taps still save.</Notice>
      )}

      <div>
        <p className="mb-1.5 text-sm text-muted">
          Optional: counselled for which course? Applies to the next tap.
        </p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Course (optional)">
          {COUNSELLING_COURSES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={course === c}
              onClick={() => setCourse(course === c ? null : c)}
              className={clsx(
                'min-h-12 rounded-btn border font-mono text-sm font-bold',
                course === c ? 'border-ink bg-ink text-page' : 'border-line bg-surface text-ink-2',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {askGroup ? (
        <GroupCountForm
          title={`How many ${askGroup === 'guided' ? 'guided-group members' : 'walk-ins'}?`}
          onCancel={() => setAskGroup(null)}
          onAdd={(n) => {
            tap(askGroup, n);
            setAskGroup(null);
          }}
        />
      ) : (
        <>
          <TapPad size="large" onClick={() => tap('guided', 1)}>
            + {FOOTFALL_VARIANT_LABELS.guided} member
          </TapPad>
          <TapPad size="large" tone="hero-alt" onClick={() => tap('walk_in', 1)}>
            + {FOOTFALL_VARIANT_LABELS.walk_in}
          </TapPad>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="min-h-16" onClick={() => setAskGroup('guided')}>
              +n guided
            </Button>
            <Button variant="secondary" className="min-h-16" onClick={() => setAskGroup('walk_in')}>
              +n walk-in
            </Button>
          </div>
        </>
      )}

      <CaptureFeedback capture={capture} />
    </div>
  );
}
