import type { BoardPerson, StationAdminDto } from '@spoh/shared';
import { Card, CountChip, Kicker } from '../../components/ui';

interface Group {
  key: string;
  title: string;
  people: BoardPerson[];
}

/** Unassigned first (the work to do), then each station, then people not available. */
export function groupBoard(people: BoardPerson[], stations: StationAdminDto[]): Group[] {
  const groups: Group[] = [
    {
      key: 'unassigned',
      title: 'Unassigned',
      people: people.filter((p) => !p.stationId && p.available),
    },
    ...stations.map((s) => ({
      key: s.id,
      title: s.active ? s.name : `${s.name} (closed)`,
      people: people.filter((p) => p.stationId === s.id),
    })),
    {
      key: 'not-available',
      title: 'Not available this day',
      people: people.filter((p) => !p.stationId && !p.available),
    },
  ];
  return groups.filter((g) => g.key === 'unassigned' || g.people.length > 0);
}

function PersonRow({
  person,
  checked,
  onToggle,
  stationName,
}: {
  person: BoardPerson;
  checked: boolean;
  onToggle: () => void;
  stationName: (id: string) => string;
}) {
  return (
    <li>
      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-btn px-1.5 py-1.5 hover:bg-surface-2">
        <input type="checkbox" className="mt-1" checked={checked} onChange={onToggle} />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{person.name}</span>
          <span className="block text-xs text-muted">
            {person.team ?? '—'}
            {person.later.map((l) => (
              <span key={l.from}>
                {' '}
                · from {l.from} → {stationName(l.stationId)}
              </span>
            ))}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          {person.unacked > 0 && (
            <CountChip count={person.unacked} one="unacked" many="unacked" tone="error" />
          )}
          {person.stationId && !person.available && (
            <span className="text-[11px] font-semibold text-low">not available</span>
          )}
        </span>
      </label>
    </li>
  );
}

/** Wireframe B2: who is where on the chosen day. Tick people, then move them. */
export function DeploymentBoard({
  groups,
  selected,
  onToggle,
  stationName,
}: {
  groups: Group[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  stationName: (id: string) => string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <Card key={g.key} role="group" aria-label={g.title} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Kicker>{g.title}</Kicker>
            <span className="font-mono text-xs text-muted">{g.people.length}</span>
          </div>
          {g.people.length === 0 ? (
            <p className="py-1 text-sm text-muted">Nobody.</p>
          ) : (
            <ul className="flex flex-col">
              {g.people.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  checked={selected.has(p.id)}
                  onToggle={() => onToggle(p.id)}
                  stationName={stationName}
                />
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
