import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { systemClock } from '../src/deps.js';
import { createTestDb, type TestDb } from './helpers/test-db.js';

/** Single-server deployments (SERVE_CLIENT=true) serve the SPA and the API together. */
describe('SERVE_CLIENT mode', () => {
  let dist: string;
  let t: TestDb;
  let app: FastifyInstance;

  beforeAll(async () => {
    dist = mkdtempSync(path.join(tmpdir(), 'spoh-dist-'));
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>SPA</title>');
    t = await createTestDb();
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'pglite://memory',
      SERVE_CLIENT: 'true',
      CLIENT_DIST_DIR: dist,
    });
    app = await buildApp({ config, db: t.db, clock: systemClock });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await t.close();
    rmSync(dist, { recursive: true, force: true });
  });

  it('serves index.html for client-side routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/duty' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>SPA</title>');
  });

  it('still returns JSON 404 for unknown API routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('still serves the API', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json().status).toBe('ok');
  });
});
