import PrismaPkg from '@prisma/client';

const { PrismaClient } = PrismaPkg;

const prisma = globalThis.__laracinePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__laracinePrisma = prisma;
}

export default prisma;
