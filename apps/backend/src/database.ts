import { PrismaPg } from '@prisma/adapter-pg';
import type { IdentityRepository } from './auth.js';
import { PrismaClient } from './generated/prisma/client.js';

let prisma: PrismaClient | null = null;

const noDatabaseRepository: IdentityRepository = {
  synchronizeExistingIdentity: async () => null
};

import pg from 'pg';

function createPrismaClient(databaseUrl: string): PrismaClient {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    allowExitOnIdle: true
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
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
      const existing = await prisma!.user.findUnique({
        where: { firebaseUid: identity.uid },
        include: { profile: { select: { id: true } } }
      });

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
