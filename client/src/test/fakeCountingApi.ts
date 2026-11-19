import { vi } from 'vitest';
import type { StationDto } from '@spoh/shared';

/**
 * A tiny stateful stand-in for the counting endpoints, installed as global fetch.
 * It keeps registration and footfall in separate lists, like the real server (Rule 1),
 * and can be told to fail the next N writes to exercise "Not saved, retrying…".
 */

export const STATIONS: StationDto[] = [
  {
    id: 's-bus',
    name: 'Bus Bay / Foyer',
    location: '',
    room: '',
    kind: 'staffed',
    team: null,
    sortOrder: 0,
  },
  {
    id: 's-booth',
    name: 'Sign-Up Booth',
    location: 'T19',
    room: '',
    kind: 'registration',
    team: null,
    sortOrder: 1,
  },
  {
    id: 's-lounge',
    name: 'Welcome Lounge',
    location: 'Welcome Lounge',
    room: 'T2036',
    kind: 'counting',
    team: null,
    sortOrder: 2,
  },
  {
    id: 's-counsel',
    name: 'Counselling Room',
    location: 'Counselling Room',
    room: 'T2135A/B',
    kind: 'counselling',
    team: null,
    sortOrder: 3,
  },
];

interface Call {
  method: string;
  path: string;
  body: unknown;
}

interface RegRow {
  clientId: string;
  stationId: string;
  category: string;
  groupId: string | null;
  deviceId: string;
}
interface FootRow {
  clientId: string;
  stationId: string;
  variant: string;
  count: number;
  course: string | null;
  deviceId: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function installFakeCountingApi() {
  const calls: Call[] = [];
  const registrations: RegRow[] = [];
  const footfall: FootRow[] = [];
  let failWrites = 0;

  const handle = (method: string, url: URL, body: unknown): Response => {
    const path = url.pathname.replace(/^\/api/, '');
    const station = url.searchParams.get('stationId');
    const device = url.searchParams.get('deviceId');
    if (method === 'GET' && path === '/stations') return json(200, { stations: STATIONS });

    if (method !== 'GET' && failWrites > 0) {
      failWrites -= 1;
      return json(503, { error: { code: 'HTTP_ERROR', message: 'Server busy' } });
    }

    if (method === 'GET' && path === '/registrations/summary') {
      const rows = registrations.filter((r) => r.stationId === station);
      const byCategory: Record<string, number> = {};
      for (const r of rows) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      const mine = rows.filter((r) => r.deviceId === device).length;
      return json(200, {
        stationId: station,
        date: '2027-01-07',
        total: rows.length,
        device: mine,
        byCategory,
      });
    }
    if (method === 'GET' && path === '/footfall/summary') {
      const rows = footfall.filter((r) => r.stationId === station);
      const byVariant: Record<string, number> = { entry: 0, guided: 0, walk_in: 0 };
      for (const r of rows) byVariant[r.variant]! += r.count;
      const sum = (list: FootRow[]) => list.reduce((n, r) => n + r.count, 0);
      return json(200, {
        stationId: station,
        date: '2027-01-07',
        total: sum(rows),
        device: sum(rows.filter((r) => r.deviceId === device)),
        byVariant,
      });
    }
    if (method === 'POST' && path === '/registrations') {
      const b = body as {
        stationId: string;
        deviceId: string;
        groupId: string | null;
        records: { clientId: string; category: string }[];
      };
      let saved = 0;
      for (const r of b.records) {
        if (registrations.some((x) => x.clientId === r.clientId)) continue;
        registrations.push({
          ...r,
          stationId: b.stationId,
          groupId: b.groupId,
          deviceId: b.deviceId,
        });
        saved += 1;
      }
      return json(200, { saved });
    }
    if (method === 'POST' && path === '/footfall') {
      const b = body as {
        stationId: string;
        deviceId: string;
        records: Omit<FootRow, 'stationId' | 'deviceId'>[];
      };
      let saved = 0;
      for (const r of b.records) {
        if (footfall.some((x) => x.clientId === r.clientId)) continue;
        footfall.push({ ...r, stationId: b.stationId, deviceId: b.deviceId });
        saved += 1;
      }
      return json(200, { saved });
    }
    const undo = path.match(/^\/(registrations|footfall)\/(.+)$/);
    if (method === 'DELETE' && undo) {
      const list: { clientId: string; groupId?: string | null }[] =
        undo[1] === 'registrations' ? registrations : footfall;
      const row = list.find((r) => r.clientId === undo[2]);
      if (!row) return json(404, { error: { code: 'NOT_FOUND', message: 'Record not found.' } });
      const gone = list.filter((r) => (row.groupId ? r.groupId === row.groupId : r === row));
      for (const g of gone) list.splice(list.indexOf(g), 1);
      return json(200, { removed: gone.length });
    }
    return json(404, { error: { code: 'NOT_FOUND', message: `No fake for ${method} ${path}` } });
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, path: url.pathname.replace(/^\/api/, ''), body });
    return handle(method, url, body);
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    registrations,
    footfall,
    writes: (path: string) => calls.filter((c) => c.method !== 'GET' && c.path.startsWith(path)),
    failNextWrites: (n: number) => {
      failWrites = n;
    },
  };
}
