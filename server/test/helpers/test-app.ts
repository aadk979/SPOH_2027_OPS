import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import type { Clock } from '../../src/deps.js';
import { createTestDb, type TestDb } from './test-db.js';

/** A clock tests can move forward explicitly. */
export class FakeClock implements Clock {
  constructor(private current = new Date('2027-01-07T02:00:00Z')) {}
  now() {
    return new Date(this.current);
  }
  set(instant: Date | string) {
    this.current = new Date(instant);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export interface TestContext extends TestDb {
  app: FastifyInstance;
  clock: FakeClock;
}

export async function createTestApp(): Promise<TestContext> {
  const testDb = await createTestDb();
  const clock = new FakeClock();
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'pglite://memory' });
  const app = await buildApp({ config, db: testDb.db, clock });
  await app.ready();
  return {
    ...testDb,
    app,
    clock,
    close: async () => {
      await app.close();
      await testDb.close();
    },
  };
}
