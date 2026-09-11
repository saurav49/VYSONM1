import { prisma } from '../../db/prisma';

async function getAnalytics() {
  const tenLatestUrlShortened = await prisma.urlShortener.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const tenMostPopularUrl = await prisma.urlShortener.findMany({
    where: { deletedAt: null },
    orderBy: [{ clicks: 'desc' }, { lastAccessedAt: 'desc' }],
    take: 10,
  });
  const tenMostShortenUrl = await prisma.urlShortener.groupBy({
    where: { deletedAt: null },
    by: ['originalUrl'],
    _count: {
      originalUrl: true,
    },
    orderBy: {
      _count: {
        originalUrl: 'desc',
      },
    },
    take: 10,
  });

  return {
    tenLatestUrlShortened,
    tenMostPopularUrl,
    tenMostShortenUrl,
  };
}

export { getAnalytics };
