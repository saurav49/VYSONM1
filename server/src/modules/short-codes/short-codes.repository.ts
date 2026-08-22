import { prisma } from '../../db/prisma';
import { IncrementStatsQueueTask } from '../../utils/constants';

async function findByShortCode(shortCode: string) {
  return prisma.urlShortener.findUnique({
    where: {
      shortCode,
    },
  });
}

async function findActiveByShortCode(shortCode: string) {
  return prisma.urlShortener.findUnique({
    where: {
      shortCode,
      deletedAt: null,
    },
  });
}

async function createShortCode(data: {
  originalUrl: string;
  shortCode: string;
  userId?: number;
  expiryDate: Date | null;
  password?: string;
}) {
  return prisma.urlShortener.create({
    data,
  });
}

async function updateShortCodeForUser({
  shortCode,
  userId,
  expiryDate,
  password,
}: {
  shortCode?: string;
  userId: number;
  expiryDate?: Date;
  password?: string;
}) {
  return prisma.urlShortener.updateMany({
    where: {
      shortCode,
      userId,
    },
    data: {
      expiryDate,
      password,
    },
  });
}

async function softDeleteShortCodeForUser({
  shortCode,
  userId,
}: {
  shortCode: string;
  userId: number;
}) {
  return prisma.urlShortener.updateMany({
    where: {
      shortCode,
      userId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

async function incrementRedirectStats({
  taskId,
  shortCode,
  event,
}: {
  taskId: string;
  shortCode: string;
  event: string;
}) {
  return prisma.$transaction(async (tx) => {
    const inserts = await tx.processedTask.createMany({
      data: { taskId: taskId, event: event },
      skipDuplicates: true,
    });
    if (inserts.count === 1) {
      await tx.urlShortener.update({
        where: {
          shortCode,
        },
        data: {
          clicks: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });
    }
  });
}

async function findFirstUniqueCode({
  shortCode,
  userId,
}: {
  shortCode?: string;
  userId: number;
}) {
  return await prisma.urlShortener.findFirst({
    where: {
      shortCode: shortCode,
      userId: userId,
    },
  });
}

export {
  createShortCode,
  findActiveByShortCode,
  findByShortCode,
  incrementRedirectStats,
  softDeleteShortCodeForUser,
  updateShortCodeForUser,
  findFirstUniqueCode,
};
