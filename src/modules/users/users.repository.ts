import { prisma } from '../../db/prisma';

async function createUser(data: {
  email: string;
  name: string;
  apiKey: string;
}) {
  return prisma.user.create({
    data,
  });
}

async function findUserWithShortensByApiKey(apiKey: string) {
  return prisma.user.findUnique({
    where: {
      apiKey,
    },
    include: {
      shortens: true,
    },
  });
}

async function findUserWithPaginatedShortensByApiKey({
  apiKey,
  page,
  pageSize,
}: {
  apiKey: string;
  page: number;
  pageSize: number;
}) {
  return prisma.user.findUnique({
    where: {
      apiKey,
    },
    include: {
      shortens: {
        take: pageSize,
        skip: (page - 1) * pageSize,
      },
    },
  });
}

async function softDeleteUserByApiKey(apiKey: string) {
  return prisma.user.update({
    where: {
      apiKey,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

export {
  createUser,
  findUserWithShortensByApiKey,
  findUserWithPaginatedShortensByApiKey,
  softDeleteUserByApiKey,
};
