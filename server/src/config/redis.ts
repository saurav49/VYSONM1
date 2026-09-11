import Redis from 'ioredis';

export const redis = new Redis({
  host: 'localhost',
  port: process.env?.REDIS_URL ? Number(process.env?.REDIS_URL) : 6379,
  lazyConnect: process.env.NODE_ENV === 'test',
  maxRetriesPerRequest: null,
});
