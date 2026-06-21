import { redis } from '../config/redis';
const bcrypt = require('bcrypt');
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import {
  FIFO_QUEUE_KEY,
  MAX_CACHE_SIZE,
  TASK_QUEUE,
  TaskQueueTask,
} from './constants';
import { TaskQueueAction } from './enums';
import { incrementRedirectStats } from '../modules/short-codes/short-codes.repository';

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
function isValidEmail(email: string) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}
function isValidDateTime(value: string) {
  const timestamp = Date.parse(value);
  return !isNaN(timestamp);
}
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
const options = {
  year: 'numeric' as 'numeric' | '2-digit' | undefined,
  month: 'long' as
    | 'numeric'
    | '2-digit'
    | 'long'
    | 'short'
    | 'narrow'
    | undefined,
  day: 'numeric' as 'numeric' | '2-digit' | undefined,
  hour: '2-digit' as 'numeric' | '2-digit' | undefined,
  minute: '2-digit' as 'numeric' | '2-digit' | undefined,
  second: '2-digit' as 'numeric' | '2-digit' | undefined,
  hour12: true, // Set to false for 24-hour clock
};
async function sleep() {
  return new Promise((res) => setTimeout(res, 3000));
}
async function generateThumbnail(data: {
  imagePath: string;
  file: string;
  id: number;
}) {
  const { default: sharp } = await import('sharp');

  console.log(`Generating thumbnail for user ${data.id}`);

  await sharp(data.file)
    .resize(300, 300)
    .jpeg({ quality: 90 })
    .toFile(data.imagePath);

  await prisma.user.update({
    where: {
      id: data.id,
    },
    data: {
      thumbnail: data.imagePath,
    },
  });

  console.log(`Thumbnail saved for user ${data.id}: ${data.imagePath}`);
}
async function thumbnailImagePath(id: number) {
  const env = process.env.NODE_ENV ?? 'dev';
  const outputDir = path.join(process.cwd(), 'public', 'thumbnail', env);
  await fs.mkdir(outputDir, { recursive: true });

  const uniqueName = Date.now() + '-' + `${id}`;
  return path.join(outputDir, `${uniqueName}.jpg`);
}
function isGenerateThumbnailTask(task: TaskQueueTask) {
  return task.type === TaskQueueAction.GENERATE_THUMBNAIL;
}
async function flushRedirectStatsQueue() {
  const d: Record<string, number> = {};

  const remainingQueue = [];

  for (const task of TASK_QUEUE) {
    if (
      task.type === TaskQueueAction.INCREMENT_REDIRECT_STATS &&
      task.shortCode
    ) {
      d[task.shortCode] = (d[task.shortCode] || 0) + 1;
    } else {
      remainingQueue.push(task);
    }
  }

  TASK_QUEUE.length = 0;
  TASK_QUEUE.push(...remainingQueue);

  const promises = Object.entries(d).map(([shortCode, clicks]) => {
    return incrementRedirectStats({
      shortCode,
      clicks: { increment: clicks },
    });
  });

  try {
    await Promise.all(promises);
    console.log('Increment stats task completed');
  } catch (e) {
    console.error(e);
    console.error('Increment stats failed');
  }
}
async function thumbnailGenWorker(workerName: string) {
  const reqdIndex = TASK_QUEUE.findIndex(isGenerateThumbnailTask);
  if (reqdIndex === -1) {
    console.log('No queued tasks.');
    console.log('---------------------');
    return;
  }
  const [task] = TASK_QUEUE.splice(reqdIndex, 1);
  if (!task) {
    console.log('No queued tasks.');
    console.log('---------------------');
    return;
  }
  if (!isGenerateThumbnailTask(task)) {
    return;
  }
  try {
    console.log(`Picked thumbnail task for user ${task.id} by ${workerName}`);
    await generateThumbnail({
      imagePath: task.imagePath,
      file: task.file,
      id: task.id,
    });
    console.log(
      `Thumbnail task completed for user ${task.id} by ${workerName}`,
    );
  } catch (e) {
    console.error(`Thumbnail task failed for user ${task.id}`);
    console.error(e);
  }
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
  options,
  sleep,
  generateThumbnail,
  thumbnailImagePath,
  flushRedirectStatsQueue,
  thumbnailGenWorker,
};
