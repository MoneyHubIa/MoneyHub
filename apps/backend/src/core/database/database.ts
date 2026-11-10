import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import type { IdentityRepository } from '../../modules/auth/authentication/auth.js';
import { PrismaClient } from '../../generated/prisma/client.js';

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

import pg from 'pg';

function createPrismaClient(databaseUrl: string): PrismaClient {
  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
    allowExitOnIdle: true
  });
  const adapter = new PrismaPg(pool);
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

  prisma ??= createPrismaClient(databaseUrl);

  return {
    synchronizeExistingIdentity: async (identity) => {
      const existing =
        (await prisma!.user.findUnique({
          where: { firebaseUid: identity.uid },
          include: { profile: { select: { id: true } } }
        })) ??
        (await prisma!.user.findUnique({
          where: { email: identity.email },
          include: { profile: { select: { id: true } } }
        }));

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

      const user = await prisma!.user.update({
        where: { id: existing.id },
        data: {
          firebaseUid: identity.uid,
          email: identity.email,
          emailVerifiedAt
        },
        select: { id: true }
      });

      return {
        userId: user.id,
        profileId: existing.profile?.id ?? null
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
