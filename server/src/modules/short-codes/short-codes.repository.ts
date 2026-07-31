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
  tasks,
  shortCode,
  clicks,
}: {
  tasks: IncrementStatsQueueTask[];
  shortCode: string;
  clicks: number | { increment: number };
}) {
  return prisma.$transaction(async (tx) => {
    const inserts = await tx.processedTask.createMany({
      data: tasks.map((t) => ({ taskId: t.taskId, event: t.event })),
      skipDuplicates: true,
    });
    if (inserts.count > 0) {
      await tx.urlShortener.update({
        where: {
          shortCode,
        },
        data: {
          clicks: { increment: inserts.count },
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
