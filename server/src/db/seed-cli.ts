import { connectDb } from './client.js';
import { seedDefaults } from './seed.js';

// CLI: `npm run db:seed` — inserts SPOH 2027 defaults where missing.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const { db, close } = connectDb(url);
try {
  await seedDefaults(db);
  console.log('Seed complete.');
} finally {
  await close();
}
