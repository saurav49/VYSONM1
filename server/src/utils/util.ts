import { redis } from '../config/redis';
const bcrypt = require('bcrypt');
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import {
  BASE_RETRY_DELAY_MS,
  DEAD_LETTER_QUEUE,
  FIFO_QUEUE_KEY,
  MAX_CACHE_SIZE,
  RETRY_QUEUE,
  SSE_CLIENTS,
  TASK_QUEUE,
  TaskQueueTask,
} from './constants';
import { TaskQueueAction } from './enums';
import { incrementRedirectStats } from '../modules/short-codes/short-codes.repository';
import { getAnalytics } from '../modules/analytics/analytics.service';
import { Response } from 'express';

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
async function sleep(timeInMs: number = 3000) {
  return new Promise((res) => setTimeout(res, timeInMs));
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
function isImageUploadTask(
  task: TaskQueueTask,
): task is Extract<TaskQueueTask, { event: TaskQueueAction.IMAGE_UPLOAD }> {
  return task.event === TaskQueueAction.IMAGE_UPLOAD;
}
function retryAt(attempts: number) {
  const delay = Math.min(
    BASE_RETRY_DELAY_MS * 2 ** Math.max(attempts - 1, 0),
    30 * 60_000,
  );
  return Date.now() + delay + jitter();
}
function retryOrDeadLetter(task: TaskQueueTask) {
  if (task.attempts >= task.maxAttempts) {
    DEAD_LETTER_QUEUE.push(task);
    return;
  }
  RETRY_QUEUE.push({ ...task, nextAttemptAt: retryAt(task.attempts) });
}
async function flushRedirectStatsQueue() {
  const d: Record<string, number> = {};
  const incrementClicksQueue: Array<{
    shortCode: string;
    clicks: number;
  }> = [];
  const remainingQueue = [];
  const incrementTasksByCode: Record<
    string,
    Extract<
      TaskQueueTask,
      { event: TaskQueueAction.INCREMENT_REDIRECT_STATS }
    >[]
  > = {};

  for (const task of TASK_QUEUE) {
    if (
      task.event === TaskQueueAction.INCREMENT_REDIRECT_STATS &&
      task.data.shortCode
    ) {
      if (task.attempts >= task.maxAttempts) {
        DEAD_LETTER_QUEUE.push(task);
        continue;
      }
      const attemptedTask = { ...task, attempts: task.attempts + 1 };
      d[task.data.shortCode] = (d[task.data.shortCode] || 0) + 1;
      if (incrementTasksByCode[task.data.shortCode] === null) {
        incrementTasksByCode[task.data.shortCode] = [];
      }
      incrementTasksByCode[task.data.shortCode].push(attemptedTask);
    } else {
      if (task.attempts >= task.maxAttempts) {
        DEAD_LETTER_QUEUE.push(task);
      } else {
        remainingQueue.push(task);
      }
    }
  }

  Object.entries(d).forEach(([shortCode, clicks]) => {
    incrementClicksQueue.push({
      shortCode,
      clicks,
    });
  });

  const promises = incrementClicksQueue.map((d) => {
    return incrementRedirectStats({
      shortCode: d.shortCode,
      clicks: {
        increment: d.clicks,
      },
    });
  });

  try {
    const responses = await Promise.allSettled(promises);
    responses.forEach((result, index) => {
      if (result.status === 'rejected') {
        for (const task of incrementTasksByCode[
          incrementClicksQueue[index].shortCode
        ] ?? []) {
          retryOrDeadLetter(task);
        }
      }
    });

    console.log('Increment stats task completed');
  } catch (e) {
    console.error(e);
    console.error('Increment stats failed');
  }

  TASK_QUEUE.length = 0;
  TASK_QUEUE.push(...remainingQueue);

  await sendWebhookDataHandler();
}
async function sendWebhookDataHandler() {
  try {
    const analytics = await getAnalytics();
    await fetch(process.env.ANALYTICS_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.ANALYTICS_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({
        event: 'analytics-updated',
        data: analytics,
        sentAt: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error(e);
    console.error('Webhook update failed');
  }
}
async function logUpload() {
  await sleep(1000);
}
async function notifyAdmin() {
  await sleep(2000);
}
async function imageProcessingWorker(workerName: string) {
  const reqdIndex = TASK_QUEUE.findIndex(isImageUploadTask);
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
  if (!isImageUploadTask(task)) {
    return;
  }
  if (task.attempts >= task.maxAttempts) {
    DEAD_LETTER_QUEUE.push(task);
    return;
  }
  const attemptedTask = { ...task, attempts: task.attempts + 1 };
  try {
    console.log(
      `Picked thumbnail task for user ${task.data.id} by ${workerName}`,
    );
    await Promise.all(
      SUBSCRIBERS[task.event].map((t) => t(attemptedTask.data)),
    );
    console.log(
      `Thumbnail task completed for user ${task.data.id} by ${workerName}`,
    );
  } catch (e) {
    console.error(`Thumbnail task failed for user ${task.data.id}`);
    console.error(e);
    retryOrDeadLetter(attemptedTask);
  }
}
function jitter() {
  return Math.random() * 5_000;
}
async function retryQueueWorker() {
  const now = Date.now();
  const dueTasks = RETRY_QUEUE.filter((task) => task.nextAttemptAt <= now);
  const waitingTasks = RETRY_QUEUE.filter((task) => task.nextAttemptAt > now);
  RETRY_QUEUE.length = 0;
  RETRY_QUEUE.push(...waitingTasks);

  const statsByCode: Record<
    string,
    Extract<
      TaskQueueTask,
      { event: TaskQueueAction.INCREMENT_REDIRECT_STATS }
    >[]
  > = {};
  const imageTasks: Extract<
    TaskQueueTask,
    { event: TaskQueueAction.IMAGE_UPLOAD }
  >[] = [];

  for (const task of dueTasks) {
    if (task.attempts >= task.maxAttempts) {
      DEAD_LETTER_QUEUE.push(task);
    } else if (isImageUploadTask(task)) {
      imageTasks.push({ ...task, attempts: task.attempts + 1 });
    } else {
      const attemptedTask = { ...task, attempts: task.attempts + 1 };
      statsByCode[task.data.shortCode] = statsByCode[task.data.shortCode] ?? [];
      statsByCode[task.data.shortCode].push(attemptedTask);
    }
  }

  await Promise.all(
    Object.entries(statsByCode).map(async ([shortCode, tasks]) => {
      try {
        await incrementRedirectStats({
          shortCode,
          clicks: { increment: tasks.length },
        });
      } catch (e) {
        console.error(`Increment stats retry failed for ${shortCode}`);
        console.error(e);
        tasks.forEach(retryOrDeadLetter);
      }
    }),
  );

  await Promise.all(
    imageTasks.map(async (task) => {
      try {
        await Promise.all(SUBSCRIBERS[task.event].map((t) => t(task.data)));
      } catch (e) {
        console.error(`Thumbnail retry failed for user ${task.data.id}`);
        console.error(e);
        retryOrDeadLetter(task);
      }
    }),
  );
}
const SUBSCRIBERS = {
  [TaskQueueAction.IMAGE_UPLOAD]: [generateThumbnail, logUpload, notifyAdmin],
};
function sendSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
async function broadcastSSELeaderboard() {
  const leaderboard = await getAnalytics();
  for (const client of SSE_CLIENTS) {
    sendSse(client, 'leaderboard_update', leaderboard);
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
  imageProcessingWorker,
  SUBSCRIBERS,
  logUpload,
  notifyAdmin,
  sendSse,
  broadcastSSELeaderboard,
  retryQueueWorker,
};
