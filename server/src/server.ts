import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { runSeed } from './scripts/seed.js';

async function main() {
  await connectDb();
  // Ensure Atlas/production always has admin + demo data (idempotent).
  await runSeed();
  const app = createApp();
  const host = process.env.HOST ?? '0.0.0.0';
  app.listen(env.port, host, () => {
    console.log(`SureTech eBMR API listening on http://${host}:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
