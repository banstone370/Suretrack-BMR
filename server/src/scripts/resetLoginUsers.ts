import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Role } from '../types/enums.js';
import { hashPassword } from '../utils/authTokens.js';
import { runSeed } from './seed.js';

/**
 * Ensures admin + demo users exist with known passwords in the target DB.
 * Usage: MONGODB_URI=... npx tsx src/scripts/resetLoginUsers.ts
 */
async function main() {
  await connectDb();
  console.log('DB:', mongoose.connection.name);

  const email = env.seedAdminEmail.toLowerCase();
  const password = env.seedAdminPassword;
  const hash = await hashPassword(password);

  const admin = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        employeeId: 'ADM-001',
        name: 'System Admin',
        email,
        passwordHash: hash,
        role: Role.ADMIN,
        department: 'Administration',
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`Admin ready: ${admin.email} / ${password}`);

  await runSeed();

  // Force-reset demo passwords too (in case hashes drifted)
  const demos = [
    'production@suretech.local',
    'qc@suretech.local',
    'packing@suretech.local',
    'sterilization@suretech.local',
    'qa@suretech.local',
    'dispatch@suretech.local',
  ];
  const demoHash = await hashPassword('Demo@12345');
  for (const demoEmail of demos) {
    const u = await User.findOneAndUpdate(
      { email: demoEmail },
      { $set: { passwordHash: demoHash, isActive: true } },
      { new: true },
    );
    if (u) console.log(`Reset password: ${demoEmail} / Demo@12345`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
