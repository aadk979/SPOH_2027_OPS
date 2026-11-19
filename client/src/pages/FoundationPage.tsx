import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BrandMark, Button, Card, Kicker, Meter, Stat, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { applyTheme, loadTheme, resolveTheme } from '../lib/theme';

interface Health {
  status: 'ok';
  db: 'ok' | 'down';
  time: string;
}

/**
 * Slice S0 landing page: proves client ↔ API ↔ DB wiring and shows the design-system
 * components. Replaced by the login and role-based home screens in slice S1.
 */
export function FoundationPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
    refetchInterval: 10_000,
  });
  const [theme, setTheme] = useState(() => resolveTheme(loadTheme()));

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-bold">
          <BrandMark /> SPOH 2027 Ops
        </div>
        <Button variant="secondary" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light' : 'Dark'} mode
        </Button>
      </header>

      <Card>
        <Kicker>System status</Kicker>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {health.isPending && <span className="text-sm text-muted">Checking…</span>}
          {health.isError && <StatusPill status="busy">API unreachable</StatusPill>}
          {health.data && (
            <>
              <StatusPill status="ok">API</StatusPill>
              <StatusPill status={health.data.db === 'ok' ? 'ok' : 'busy'}>Database</StatusPill>
              <span className="font-mono text-xs text-muted">{health.data.time}</span>
            </>
          )}
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Registered today" value="612" />
        <Stat label="On duty" value="88" suffix="/ 94" footer="9 on break now" />
        <Card>
          <Kicker>Room alerts</Kicker>
          <div className="mt-2 flex flex-col items-start gap-1.5">
            <StatusPill status="busy">Counselling</StatusPill>
            <StatusPill status="quiet">LT18A</StatusPill>
          </div>
        </Card>
        <Card>
          <Kicker>Gift stock</Kicker>
          <div className="mt-2">
            <StatusPill status="low">Tote 18/200</StatusPill>
          </div>
        </Card>
      </section>

      <Card className="flex flex-col gap-3">
        <Kicker>Meters</Kicker>
        <Meter percent={55} label="Welcome Lounge" />
        <Meter percent={97} status="busy" label="Counselling Room" />
        <Meter percent={4} status="quiet" label="School Talk" />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button>Got it</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Reset…</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <button
        type="button"
        className="grid h-40 place-items-center rounded-hero bg-hero font-mono text-5xl font-extrabold text-on-hero active:scale-[0.98]"
      >
        +1
      </button>
    </main>
  );
}
