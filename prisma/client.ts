import { PrismaClient } from '@prisma/client';
import { neon } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaWithAdapter: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL environment variable is not set. Please create a .env.local file with your database connection string.'
  );
}

// PrismaClient without adapter for PrismaAdapter compatibility
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: ['query', 'warn', 'error'],
  });

// PrismaClient with adapter for other queries (if needed)
const neonClient = neon(connectionString);
const adapter = new PrismaNeon(neonClient as any);

export const prismaWithAdapter =
  globalThis.prismaWithAdapter ??
  new PrismaClient({
    adapter,
    log: ['query', 'warn', 'error'],
  });

// production이 아니면 global에 저장
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
  globalThis.prismaWithAdapter = prismaWithAdapter;
}
