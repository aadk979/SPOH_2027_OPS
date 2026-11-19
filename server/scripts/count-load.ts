/**
 * FR-REG-6 acceptance check against a RUNNING server and its real Postgres:
 * 5 devices x 2 taps/s for 60 s at the Sign-Up Booth must add exactly 600 registrations.
 * Every 10th tap is re-sent (a simulated retry) and must not be double counted.
 *
 *   API_URL=http://localhost:3999 SPOH_TOKEN=<bearer token> npm run load:counting -w server
 *
 * Get a token by signing in through the app and reading localStorage "spoh.token".
 * Optional: DEVICES (5), RATE (taps/s per device, 2), SECONDS (60).
 * The taps are real records: run it on a dev/test database, then use Reset all counts.
 */
import { randomUUID } from 'node:crypto';

const API = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = process.env.SPOH_TOKEN;
const DEVICES = Number(process.env.DEVICES ?? 5);
const RATE = Number(process.env.RATE ?? 2);
const SECONDS = Number(process.env.SECONDS ?? 60);

if (!TOKEN) {
  console.error('Set SPOH_TOKEN to a signed-in bearer token.');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

const latencies: number[] = [];

/** One tap; retried with the same clientId until it lands (as the client does). */
async function tap(stationId: string, deviceId: string, clientId: string) {
  const body = JSON.stringify({ stationId, deviceId, records: [{ clientId, category: 'sec4' }] });
  for (let attempt = 1; ; attempt += 1) {
    const started = performance.now();
    try {
      await call('/registrations', { method: 'POST', body });
      latencies.push(performance.now() - started);
      return;
    } catch (err) {
      if (attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
}

async function main() {
  const { stations } = await call<{ stations: { id: string; name: string }[] }>('/stations');
  const booth = stations.find((s) => s.name === 'Sign-Up Booth');
  if (!booth) throw new Error('Sign-Up Booth station not found.');
  const summary = () => call<{ total: number }>(`/registrations/summary?stationId=${booth.id}`);

  const before = (await summary()).total;
  const expected = DEVICES * RATE * SECONDS;
  console.log(`Sending ${expected} taps: ${DEVICES} devices x ${RATE}/s x ${SECONDS}s → ${API}`);

  const inFlight: Promise<void>[] = [];
  for (let d = 0; d < DEVICES; d += 1) {
    const deviceId = `load-${randomUUID()}`;
    for (let i = 0; i < RATE * SECONDS; i += 1) {
      const clientId = randomUUID();
      const at = (i / RATE) * 1000 + Math.random() * 50;
      inFlight.push(
        new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            const sends = [tap(booth.id, deviceId, clientId)];
            if (i % 10 === 0) sends.push(tap(booth.id, deviceId, clientId)); // duplicate
            Promise.all(sends).then(() => resolve(), reject);
          }, at);
        }),
      );
    }
  }
  await Promise.all(inFlight);

  const added = (await summary()).total - before;
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  console.log(`Added ${added} (expected ${expected}). p95 tap latency ${p95.toFixed(0)} ms.`);
  if (added !== expected) {
    console.error('FAIL: total does not match.');
    process.exit(1);
  }
  console.log('PASS');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
