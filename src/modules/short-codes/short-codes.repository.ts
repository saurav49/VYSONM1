import { prisma } from '../../db/prisma';

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
  shortCode,
  clicks,
}: {
  shortCode: string;
  clicks: number;
}) {
  return prisma.urlShortener.update({
    where: {
      shortCode,
    },
    data: {
      clicks,
      lastAccessedAt: new Date(),
    },
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
