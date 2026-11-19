import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { seedDefaults } from './db/seed.js';
import { systemClock } from './deps.js';

/** Production / dev entry point: migrate, seed defaults, start listening. */
async function main() {
  const config = loadConfig();
  await runMigrations(config.DATABASE_URL);

  const { db, close } = connectDb(config.DATABASE_URL);
  await seedDefaults(db);

  const app = await buildApp({ config, db, clock: systemClock });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
