import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { pickDefaultDay, sgtDateString, type AssignResponse } from '@spoh/shared';
import { Button, DayTabs, Notice, PageHeader, TextField } from '../../components/ui';
import { useDays } from '../people/peopleApi';
import { useAdminStations } from '../setup/setupApi';
import { DeploymentBoard, groupBoard } from './DeploymentBoard';
import { useBoard, useUnacked } from './deploymentApi';
import { MovePanel } from './MovePanel';
import { UnackedList } from './UnackedList';

/** Wireframe B2: assign and reassign, and see who hasn't acknowledged (FR-DUTY-2/3/4/8). */
export function DeploymentPage() {
  const days = useDays();
  const stations = useAdminStations();
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const dayId = chosenDay ?? pickDefaultDay(days.data ?? [], sgtDateString(new Date()))?.id ?? null;
  const board = useBoard(dayId);
  const unacked = useUnacked({ stationId: '', team: '' });
  const [tab, setTab] = useState<'board' | 'changes'>('board');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<AssignResponse | null>(null);

  const stationList = useMemo(() => stations.data ?? [], [stations.data]);
  const stationName = (id: string) => stationList.find((s) => s.id === id)?.name ?? 'Unknown';
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const people = (board.data ?? []).filter(
      (p) => !q || p.name.toLowerCase().includes(q) || (p.team ?? '').toLowerCase().includes(q),
    );
    return groupBoard(people, stationList);
  }, [board.data, query, stationList]);

  const toggle = (id: string) => {
    setResult(null);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const unassigned = groups.find((g) => g.key === 'unassigned')?.people.length ?? 0;
  const unackedCount = unacked.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Deployment"
        subtitle={`Unassigned: ${unassigned} · Unacknowledged changes: ${unackedCount}`}
      />
      <DayTabs
        days={days.data ?? []}
        value={dayId}
        onChange={(id) => {
          setChosenDay(id);
          setSelected(new Set());
        }}
      />
      <div role="tablist" aria-label="Deployment view" className="flex gap-1 border-b border-line">
        {(['board', 'changes'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold',
              tab === t ? 'border-accent text-ink' : 'border-transparent text-muted',
            )}
          >
            {t === 'board' ? 'Board' : `Changes (${unackedCount} unacked)`}
          </button>
        ))}
      </div>

      {tab === 'changes' ? (
        <UnackedList stations={stationList} />
      ) : (
        <>
          {days.data?.length === 0 && <Notice>Add event days in Setup first.</Notice>}
          {board.error && <Notice tone="error">{board.error.message}</Notice>}
          {result && (
            <Notice tone="ok">
              ✓ Saved: {result.assigned} {result.assigned === 1 ? 'post' : 'posts'}
              {result.unchanged > 0 && ` (${result.unchanged} already there)`}.
            </Notice>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <TextField
                label="Search people"
                placeholder="Name or team"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {selected.size > 0 && (
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                Clear {selected.size} selected
              </Button>
            )}
          </div>
          {selected.size > 0 && dayId && (
            <MovePanel
              personIds={[...selected]}
              stations={stationList}
              days={days.data ?? []}
              dayId={dayId}
              onDone={(r) => {
                setResult(r);
                setSelected(new Set());
              }}
            />
          )}
          <DeploymentBoard
            groups={groups}
            selected={selected}
            onToggle={toggle}
            stationName={stationName}
          />
        </>
      )}
    </div>
  );
}
