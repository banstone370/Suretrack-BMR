import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';

async function main() {
  await connectDb();
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
