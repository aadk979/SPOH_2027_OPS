import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { schema, type Db } from '../../src/db/client.js';
import { MIGRATIONS_DIR } from '../../src/db/migrate.js';
import { seedDefaults } from '../../src/db/seed.js';

export interface TestDb {
  db: Db;
  close: () => Promise<void>;
}

/**
 * A fresh in-memory PostgreSQL (PGlite) with real migrations applied, so tests exercise
 * the same SQL as production without needing Docker. Each call is fully isolated.
 */
export async function createTestDb(options: { seed?: boolean } = {}): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: 'snake_case' }) as unknown as Db;
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
  if (options.seed !== false) await seedDefaults(db);
  return { db, close: () => client.close() };
}
