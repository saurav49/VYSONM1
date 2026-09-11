import { redis } from '../config/redis';
const bcrypt = require('bcrypt');
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import {
  DEFAULT_QUEUE_CONFIG,
  FIFO_QUEUE_KEY,
  ImageUploadQueueTask,
  MAX_CACHE_SIZE,
  SSE_CLIENTS,
} from './constants';
import { TaskQueueAction } from './enums';
import { getAnalytics } from '../modules/analytics/analytics.service';
import { Response } from 'express';
import { notificationQueue } from './queue';
import {
  handleImageAggregationTimeout as orchestrateImageAggregationTimeout,
  markImageStepCompleted as orchestrateImageStepCompletion,
  type ImageAggregationDependencies,
  type ImageAggregationStep,
  type ImageTimeoutDependencies,
} from './image-aggregation';

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
async function generateThumbnail(task: ImageUploadQueueTask) {
  const data = task.data;
  const response = await prisma.user.findUnique({
    where: {
      id: data.id,
    },
  });
  if (response?.thumbnail) {
    return response;
  }
  const { default: sharp } = await import('sharp');

  console.log(`Generating thumbnail for user ${data.id}`);

  await sharp(data.file)
    .resize(300, 300)
    .jpeg({ quality: 90 })
    .toFile(data.imagePath);

  await prisma.$transaction(async (tx) => {
    const inserts = await tx.processedTask.createMany({
      data: {
        taskId: task.taskId,
        event: task.event,
      },
      skipDuplicates: true,
    });
    if (inserts.count === 0) return;
    await tx.user.update({
      where: {
        id: data.id,
      },
      data: {
        thumbnail: data.imagePath,
      },
    });
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
async function markImageStepCompleted(
  taskId: string,
  userId: number,
  step: ImageAggregationStep,
  dependencies: ImageAggregationDependencies = imageAggregationDependencies,
) {
  return orchestrateImageStepCompletion(taskId, userId, step, dependencies);
}

const imageAggregationDependencies: ImageAggregationDependencies = {
  updateAndClaim: async (taskId, userId, step) =>
    prisma.$transaction(async (tx) => {
      const completedAt = new Date();
      await tx.imageProcessingAggregate.updateMany({
        where:
          step === 'thumbnail'
            ? { taskId, userId, thumbnailReady: false }
            : { taskId, userId, safetyCheckCompleted: false },
        data:
          step === 'thumbnail'
            ? { thumbnailReady: true, thumbnailCompletedAt: completedAt }
            : {
                safetyCheckCompleted: true,
                safetyCheckCompletedAt: completedAt,
              },
      });

      const aggregate = await tx.imageProcessingAggregate.findUnique({
        where: { taskId },
      });
      if (!aggregate || aggregate.userId !== userId) {
        throw new Error(`Image processing aggregate ${taskId} was not found`);
      }
      const completedWithinDeadline =
        aggregate.thumbnailCompletedAt !== null &&
        aggregate.safetyCheckCompletedAt !== null &&
        aggregate.thumbnailCompletedAt <= aggregate.deadlineAt &&
        aggregate.safetyCheckCompletedAt <= aggregate.deadlineAt;

      if (!completedWithinDeadline) return false;

      const claimed = await tx.imageProcessingAggregate.updateMany({
        where: {
          taskId,
          userId,
          thumbnailReady: true,
          safetyCheckCompleted: true,
          notificationTriggered: false,
          timedOut: false,
        },
        data: { notificationTriggered: true },
      });

      return claimed.count === 1;
    }),
  enqueueNotification: async (taskId, userId) => {
    await notificationQueue.add(
      'notify-user',
      {
        event: TaskQueueAction.IMAGE_PROCESSING_COMPLETED,
        taskId,
        userId,
      },
      {
        ...DEFAULT_QUEUE_CONFIG,
        jobId: `${taskId}:notification`,
      },
    );
  },
  releaseClaim: async (taskId, userId) => {
    await prisma.imageProcessingAggregate.updateMany({
      where: { taskId, userId, notificationTriggered: true },
      data: { notificationTriggered: false },
    });
  },
};

async function handleImageAggregationTimeout(
  taskId: string,
  userId: number,
  now: Date = new Date(),
  dependencies: ImageTimeoutDependencies = imageTimeoutDependencies,
) {
  return orchestrateImageAggregationTimeout(taskId, userId, now, dependencies);
}

const imageTimeoutDependencies: ImageTimeoutDependencies = {
  claimOutcome: async (taskId, userId, now) =>
    prisma.$transaction(async (tx) => {
      // Take a row lock through an update before classifying the outcome. This
      // serializes the timeout decision with either upstream completion.
      const locked = await tx.imageProcessingAggregate.updateMany({
        where: { taskId, userId, notificationTriggered: false, timedOut: false },
        data: { updatedAt: now },
      });
      if (locked.count !== 1) return null;

      const aggregate = await tx.imageProcessingAggregate.findUniqueOrThrow({
        where: { taskId },
      });
      if (aggregate.deadlineAt > now) return null;

      const completedWithinDeadline =
        aggregate.thumbnailCompletedAt !== null &&
        aggregate.safetyCheckCompletedAt !== null &&
        aggregate.thumbnailCompletedAt <= aggregate.deadlineAt &&
        aggregate.safetyCheckCompletedAt <= aggregate.deadlineAt;

      const completed = await tx.imageProcessingAggregate.updateMany({
        where: {
          taskId,
          userId,
          notificationTriggered: false,
          timedOut: false,
        },
        data: completedWithinDeadline
          ? { notificationTriggered: true }
          : { timedOut: true, manualReviewTriggered: true },
      });
      if (completed.count !== 1) return null;
      return completedWithinDeadline ? 'completed' : 'manual-review';
    }),
  enqueueCompletion: imageAggregationDependencies.enqueueNotification,
  enqueueManualReview: async (taskId, userId) => {
    await notificationQueue.add(
      'manual-review',
      {
        event: TaskQueueAction.IMAGE_PROCESSING_MANUAL_REVIEW,
        taskId,
        userId,
        reason: 'Image processing steps did not complete before the deadline',
      },
      {
        ...DEFAULT_QUEUE_CONFIG,
        jobId: `${taskId}:manual-review`,
      },
    );
  },
  releaseOutcome: async (taskId, userId, outcome) => {
    if (outcome === 'completed') {
      await imageAggregationDependencies.releaseClaim(taskId, userId);
      return;
    }
    await prisma.imageProcessingAggregate.updateMany({
      where: {
        taskId,
        userId,
        timedOut: true,
        manualReviewTriggered: true,
      },
      data: { timedOut: false, manualReviewTriggered: false },
    });
  },
};
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
  SUBSCRIBERS,
  logUpload,
  notifyAdmin,
  sendSse,
  broadcastSSELeaderboard,
  sendWebhookDataHandler,
  markImageStepCompleted,
  handleImageAggregationTimeout,
};
