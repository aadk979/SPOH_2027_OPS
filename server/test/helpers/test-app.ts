import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Rank } from '@spoh/shared';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { person } from '../../src/db/schema/index.js';
import type { Clock } from '../../src/deps.js';
import { CapturingEmailSender } from '../../src/email/index.js';
import { createTestDb, type TestDb } from './test-db.js';

/** A clock tests can move explicitly. Starts at 10:00 SGT on 7 Jan 2027. */
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

export interface TestPerson {
  id: string;
  email: string;
  token: string;
}

export interface TestContext extends TestDb {
  app: FastifyInstance;
  clock: FakeClock;
  email: CapturingEmailSender;
  /** Creates a person of the given rank and signs them in through the real login flow. */
  signIn(rank: Rank, overrides?: Partial<typeof person.$inferInsert>): Promise<TestPerson>;
  /** app.inject with a bearer token. */
  as(user: TestPerson | null, options: InjectOptions): Promise<LightMyRequestResponse>;
}

const DEFAULT_TEAM: Partial<Record<Rank, string>> = {
  volunteer: 'Sign-Up Booth',
  ic: 'Sign-Up Booth',
};
const DEFAULT_PORTFOLIO: Partial<Record<Rank, string>> = {
  deputy: 'Operations & Crowd Management',
  shadow_ic: 'Operations & Crowd Management',
};

export async function createTestApp(): Promise<TestContext> {
  const testDb = await createTestDb();
  const clock = new FakeClock();
  const email = new CapturingEmailSender();
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'pglite://memory' });
  const app = await buildApp({ config, db: testDb.db, clock, email });
  await app.ready();
  let counter = 0;

  const signIn: TestContext['signIn'] = async (rank, overrides = {}) => {
    counter += 1;
    const address = overrides.email ?? `${rank}${counter}@ichat.sp.edu.sg`;
    const [p] = await testDb.db
      .insert(person)
      .values({
        name: `${rank} ${counter}`,
        rank,
        team: DEFAULT_TEAM[rank] ?? null,
        portfolio: DEFAULT_PORTFOLIO[rank] ?? null,
        ...overrides,
        email: address,
      })
      .returning();
    await app.inject({ method: 'POST', url: '/api/auth/request', payload: { email: address } });
    const code = email.last()!.subject.match(/(\d{6})$/)![1]!;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      payload: { email: address, code },
    });
    return { id: p!.id, email: address, token: res.json().token };
  };

  const as: TestContext['as'] = (user, options) =>
    app.inject({
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(user ? { authorization: `Bearer ${user.token}` } : {}),
      },
    });

  return {
    ...testDb,
    app,
    clock,
    email,
    signIn,
    as,
    close: async () => {
      await app.close();
      await testDb.close();
    },
  };
}
