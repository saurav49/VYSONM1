import { redis } from '../config/redis';
const bcrypt = require('bcrypt');
import crypto from 'crypto';

const FIFO_QUEUE_KEY = 'cache:fifo:shortCodes';
const MAX_CACHE_SIZE = 1000;

async function deleteCache(code: string) {
  await redis.del(`shortCode:${code}`);
}
async function setCache({
  code,
  originalUrl,
}: {
  code: string;
  originalUrl: string;
}) {
  const cachedKey = `shortCode:${code}`;
  await redis.set(cachedKey, originalUrl, 'EX', 3600);
}
async function setCacheFIFO({
  code,
  originalUrl,
}: {
  code: string;
  originalUrl: string;
}) {
  const cachedKey = `shortCode:${code}`;
  const exists = await redis.exists(cachedKey);

  await redis.set(cachedKey, originalUrl, 'EX', 3600);

  if (!exists) {
    await redis.rpush(FIFO_QUEUE_KEY, cachedKey);
  }
  const size = await redis.llen(FIFO_QUEUE_KEY);
  if (size > MAX_CACHE_SIZE) {
    const oldestKey = await redis.lpop(FIFO_QUEUE_KEY);
    if (oldestKey) {
      await redis.del(oldestKey);
    }
  }
}
async function getCache(code: string) {
  return await redis.get(`shortCode:${code}`);
}
const isValidEmail = (email: string) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};
const isValidDateTime = (value: string) => {
  const timestamp = Date.parse(value);
  return !isNaN(timestamp);
};
async function hashPassword(password: string) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}
function hasFeature(userId: string) {
  const hash = crypto.createHash('sha256').update(String(userId)).digest('hex');
  const bucket = parseInt(hash.substring(0, 8), 16) % 100;

  return bucket < 10;
}
async function retryLogic<T>({
  fn,
  retires = 3,
  delay = 200,
}: {
  fn: () => Promise<T>;
  retires: number;
  delay: number;
}): Promise<T> {
  let error: any;
  for (let i = 0; i < retires; i++) {
    try {
      return await fn();
    } catch (e) {
      console.error(`Retry ${i} : ${e}`);
      error = e;
      new Promise((res) => setTimeout(res, delay * 2 ** i));
    }
  }
  throw error;
}
export {
  isValidEmail,
  isValidDateTime,
  hashPassword,
  deleteCache,
  setCache,
  getCache,
  setCacheFIFO,
  hasFeature,
  retryLogic,
};
