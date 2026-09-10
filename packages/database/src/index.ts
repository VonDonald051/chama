import { PrismaClient } from '@prisma/client';

/**
 * One client per API process. DATABASE_URL must point at the environment-specific
 * PostgreSQL instance and enforce TLS in production.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export { PrismaClient, Prisma } from '@prisma/client';
