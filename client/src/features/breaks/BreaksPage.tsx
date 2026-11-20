import { useState } from 'react';
import { pickDefaultDay, sgtDateString, type AddBreakResponse } from '@spoh/shared';
import { Button, DayTabs, Notice, PageHeader } from '../../components/ui';
import { useDays, useLists } from '../people/peopleApi';
import { BreakForm } from './BreakForm';
import { useActiveStations, useBreakPeople, useBreaks } from './breaksApi';
import { SlotCard } from './SlotCard';

/** Wireframe: Welfare IC / Admin break planning for one day (FR-BRK-1..5). */
export function BreaksPage() {
  const days = useDays();
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const dayId = chosenDay ?? pickDefaultDay(days.data ?? [], sgtDateString(new Date()))?.id ?? null;
  const slots = useBreaks(dayId);
  const people = useBreakPeople(dayId);
  const stations = useActiveStations();
  const lists = useLists();
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<AddBreakResponse | null>(null);

  const onBreak = (people.data ?? []).filter((p) => p.onBreakUntil);
  const total = (slots.data ?? []).reduce((n, s) => n + s.people.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Breaks"
        subtitle={`${slots.data?.length ?? 0} slots · ${total} people · on break now: ${onBreak.length}`}
      />
      <DayTabs
        days={days.data ?? []}
        value={dayId}
        onChange={(id) => {
          setChosenDay(id);
          setAdding(false);
          setResult(null);
        }}
      />

      {onBreak.length > 0 && (
        <Notice>
          On break now: {onBreak.map((p) => `${p.name} (until ${p.onBreakUntil})`).join(', ')}
        </Notice>
      )}
      {result && (
        <Notice tone="ok">
          ✓ Break added for {result.added} {result.added === 1 ? 'person' : 'people'}
          {result.unchanged > 0 && ` (${result.unchanged} already had it)`}.
        </Notice>
      )}
      {(slots.error || people.error) && (
        <Notice tone="error">{(slots.error ?? people.error)!.message}</Notice>
      )}

      {dayId &&
        (adding ? (
          <BreakForm
            dayId={dayId}
            people={people.data ?? []}
            stations={stations.data ?? []}
            teams={lists.data?.teams ?? []}
            onDone={(r) => {
              setResult(r);
              setAdding(false);
            }}
          />
        ) : (
          <Button
            onClick={() => {
              setResult(null);
              setAdding(true);
            }}
          >
            Add break
          </Button>
        ))}

      {slots.data?.length === 0 && !adding && (
        <p className="text-sm text-muted">No breaks planned for this day yet.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {dayId &&
          slots.data?.map((s) => (
            <SlotCard key={`${s.start}|${s.end}|${s.label}`} dayId={dayId} slot={s} />
          ))}
      </div>
    </div>
  );
}
