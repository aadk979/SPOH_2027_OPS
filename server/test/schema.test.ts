import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appConfig, eventDay, station } from '../src/db/schema/index.js';
import { seedDefaults } from '../src/db/seed.js';
import { createTestDb, type TestDb } from './helpers/test-db.js';

describe('database schema and seed', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.close());

  it('has exactly the 15 designed tables (NFR-M-6)', async () => {
    const rows = await t.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    const names = (rows as unknown as { rows: { table_name: string }[] }).rows.map(
      (r) => r.table_name,
    );
    expect(names).toHaveLength(15);
  });

  it('T-06: no visitor-identity columns exist on count tables (Rule 2)', async () => {
    const rows = await t.db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
          where table_name in ('registration', 'footfall')`,
    );
    const cols = (rows as unknown as { rows: { column_name: string }[] }).rows.map(
      (r) => r.column_name,
    );
    for (const forbidden of ['name', 'email', 'phone', 'nric', 'school', 'visitor_name']) {
      expect(cols).not.toContain(forbidden);
    }
  });

  it('seeds SPOH 2027 defaults and is idempotent', async () => {
    await seedDefaults(t.db); // second run must not duplicate
    const days = await t.db.select().from(eventDay);
    const stations = await t.db.select().from(station);
    const config = await t.db.select().from(appConfig);
    expect(days.map((d) => d.date)).toEqual([
      '2027-01-06',
      '2027-01-07',
      '2027-01-08',
      '2027-01-09',
    ]);
    expect(stations).toHaveLength(9);
    expect(config).toHaveLength(1);
    expect(config[0]?.teams).toContain('Welfare');
  });
});
