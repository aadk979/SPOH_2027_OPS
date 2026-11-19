import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema/index.js';

export { schema };

/**
 * Database handle used throughout the app. Typed against the generic Postgres base so
 * production (node-postgres) and tests (in-memory PGlite) share the same code paths.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbConnection {
  db: Db;
  close: () => Promise<void>;
}

export function connectDb(databaseUrl: string): DbConnection {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, close: () => pool.end() };
}

/** A transaction handle; services that may run inside a transaction accept `Db | Tx`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
