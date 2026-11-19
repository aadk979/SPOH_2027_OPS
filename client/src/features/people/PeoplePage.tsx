import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { RANK_LABELS, RANKS, type PersonDto, type Rank } from '@spoh/shared';
import {
  Button,
  Card,
  Kicker,
  Notice,
  PageHeader,
  SelectField,
  TextField,
} from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useIssueCode, usePeople } from './peopleApi';
import { PersonForm } from './PersonForm';

function IssuedCode({ personId, name }: { personId: string; name: string }) {
  const issue = useIssueCode();
  if (issue.data) {
    return (
      <span className="font-mono text-sm">
        Code for {name}: <b className="text-base tracking-widest">{issue.data.code}</b>
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      className="px-2 py-1 text-xs"
      disabled={issue.isPending}
      onClick={() => issue.mutate(personId)}
    >
      Login code
    </Button>
  );
}

/** Admin roster: search, filter, add, edit, deactivate, issue login codes (FR-CFG-4, FR-AUTH-5). */
export function PeoplePage() {
  const { user } = useAuth();
  const people = usePeople();
  const [query, setQuery] = useState('');
  const [rank, setRank] = useState<Rank | ''>('');
  const [editing, setEditing] = useState<PersonDto | 'new' | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people.data ?? []).filter(
      (p) =>
        (!rank || p.rank === rank) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.email.includes(q) ||
          (p.team ?? '').toLowerCase().includes(q)),
    );
  }, [people.data, query, rank]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="People"
        subtitle={
          people.data
            ? `${people.data.filter((p) => p.active).length} active on the roster`
            : undefined
        }
        actions={
          <>
            {user?.tier === 'cc' && (
              <Link to="/people/import">
                <Button variant="secondary">Import CSV</Button>
              </Link>
            )}
            <Button onClick={() => setEditing('new')}>Add person</Button>
          </>
        }
      />

      {editing && (
        <PersonForm
          key={editing === 'new' ? 'new' : editing.id}
          person={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <TextField
          label="Search"
          placeholder="Name, email or team"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SelectField
          label="Rank"
          value={rank}
          placeholder="All ranks"
          options={RANKS.map((r) => ({ value: r, label: RANK_LABELS[r] }))}
          onChange={(e) => setRank(e.target.value as Rank | '')}
        />
      </div>

      {people.error && <Notice tone="error">{people.error.message}</Notice>}
      {people.isPending && <p className="text-sm text-muted">Loading…</p>}
      {people.data?.length === 0 && (
        <Notice>
          No one on the roster yet.{' '}
          {user?.tier === 'cc'
            ? 'Import the roster CSV to get started.'
            : 'Ask the CC to import the roster.'}
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{p.name}</span>
                {!p.active && (
                  <span className="rounded-full bg-surface-2 px-2 text-[11px] text-muted">
                    inactive
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted">
                {RANK_LABELS[p.rank]} · {p.team ?? p.portfolio ?? '—'} · {p.email}
                {p.phone && <span className="font-mono"> · {p.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Kicker className="mr-2">{p.availableDayIds.length} days</Kicker>
              {p.active && <IssuedCode personId={p.id} name={p.name} />}
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(p)}>
                Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
