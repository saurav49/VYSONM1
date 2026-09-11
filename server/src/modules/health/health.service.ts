import { prisma } from '../../db/prisma';

async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

export { checkDatabase };
