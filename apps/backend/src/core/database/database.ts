import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import type { IdentityRepository } from '../../modules/auth/authentication/auth.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { createDatabasePool } from './pool.js';

let prisma: PrismaClient | null = null;
const databaseScope = new AsyncLocalStorage<PrismaClient>();

/** Inject a client into one asynchronous request without changing the global client. */
export function withDatabaseClient<T>(client: PrismaClient, work: () => Promise<T>): Promise<T> {
  return databaseScope.run(client, work);
}

/** Reuse an operation transaction in domain services, including nested callbacks. */
export function withTransactionClient<T>(transaction: Prisma.TransactionClient, work: () => Promise<T>): Promise<T> {
  const scoped = new Proxy(transaction, {
    get(target, property) {
      if (property === '$transaction') {
        return (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(transaction);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  }) as PrismaClient;
  return databaseScope.run(scoped, work);
}

const noDatabaseRepository: IdentityRepository = {
  synchronizeExistingIdentity: async () => {
    throw new Error('Database is unavailable: DATABASE_URL is missing.');
  }
};

function createPrismaClient(databaseUrl: string): PrismaClient {
  const pool = createDatabasePool(databaseUrl);
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  const scoped = databaseScope.getStore();
  if (scoped) return scoped;
  if (!prisma) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Prisma is not initialized. DATABASE_URL is missing.');
    }
    prisma = createPrismaClient(databaseUrl);
  }
  return prisma;
}

export function getIdentityRepository(): IdentityRepository {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return noDatabaseRepository;
  }

  return createIdentityRepository(getPrismaClient());
}

export function createIdentityRepository(client: PrismaClient): IdentityRepository {
  return {
    synchronizeExistingIdentity: async (identity) => {
      const [existing] = await client.$queryRaw<Array<{
        id: string; firebaseUid: string; email: string; emailVerifiedAt: Date | null; profileId: string | null;
      }>>(Prisma.sql`
        SELECT u.id, u.firebase_uid AS "firebaseUid", u.email,
          u.email_verified_at AS "emailVerifiedAt", p.id AS "profileId"
        FROM users u LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.firebase_uid = ${identity.uid} OR u.email = ${identity.email}
        ORDER BY (u.firebase_uid = ${identity.uid}) DESC
        LIMIT 1
      `);

      if (!existing) {
        return null;
      }

      const emailChanged = existing.email !== identity.email;
      let emailVerifiedAt = existing.emailVerifiedAt;
      if (!identity.emailVerified) {
        emailVerifiedAt = null;
      } else if (emailChanged || !emailVerifiedAt) {
        emailVerifiedAt = new Date();
      }

      if (existing.firebaseUid !== identity.uid || emailChanged
        || existing.emailVerifiedAt?.getTime() !== emailVerifiedAt?.getTime()) {
        await client.user.update({
          where: { id: existing.id },
          data: {
            firebaseUid: identity.uid,
            email: identity.email,
            emailVerifiedAt
          },
          select: { id: true }
        });
      }

      return {
        userId: existing.id,
        profileId: existing.profileId
      };
    }
  };
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
