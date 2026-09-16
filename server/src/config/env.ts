import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri: required('MONGODB_URI'),
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET ?? 'suretech-prod-access-secret-change-me-32',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ?? 'suretech-prod-refresh-secret-change-me-32',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'https://suretrack-ebmr.vercel.app',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@suretech.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
};
