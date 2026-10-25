import { getPrismaClient, disconnectDatabase } from '../core/database/database.js';
import { firebaseAuth } from '../modules/auth/authentication/auth.js';
import { assertDemoEnvironment } from './demo-data.js';
import { seedDemo } from './demo-seed.js';

try {
  assertDemoEnvironment(process.env);
  await seedDemo(getPrismaClient(), firebaseAuth());
  console.log('Demo seed ready. Existing data was preserved.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
