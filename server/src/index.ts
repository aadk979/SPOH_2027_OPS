import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { seedDefaults } from './db/seed.js';
import { systemClock } from './deps.js';
import { createEmailSender } from './email/index.js';
import { ensureBootstrapCC } from './modules/people/bootstrap.js';
import { startOutbox } from './modules/notifications/runner.js';

/** Production / dev entry point: migrate, seed defaults, start listening. */
async function main() {
  const config = loadConfig();
  await runMigrations(config.DATABASE_URL);

  const { db, close } = connectDb(config.DATABASE_URL);
  await seedDefaults(db);
  await ensureBootstrapCC(db, config.BOOTSTRAP_CC_EMAIL);

  const deps = { config, db, clock: systemClock, email: createEmailSender(config) };
  const app = await buildApp(deps);
  const stopOutbox = startOutbox(deps, app.log);
  app.log.info({ provider: deps.email.name }, 'Email provider ready');

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    stopOutbox();
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
