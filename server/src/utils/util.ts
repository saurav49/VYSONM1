import { redis } from '../config/redis';
import { Resend } from 'resend';
import { config } from '../config/env';
const resend = new Resend(config.RESEND_API_KEY);
const bcrypt = require('bcrypt');
import crypto, { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import {
  DEAD_LETTER_QUEUE,
  FIFO_QUEUE_KEY,
  ImageUploadQueueTask,
  MAX_CACHE_SIZE,
  SSE_CLIENTS,
  TASK_QUEUE,
  TaskQueueTask,
} from './constants';
import { TaskQueueAction } from './enums';
import { incrementRedirectStats } from '../modules/short-codes/short-codes.repository';
import { getAnalytics } from '../modules/analytics/analytics.service';
import { Response } from 'express';
import { deadLetterQueue, retryQueue } from './queue';

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
function isImageUploadTask(
  task: TaskQueueTask,
): task is Extract<TaskQueueTask, { event: TaskQueueAction.IMAGE_UPLOAD }> {
  return task.event === TaskQueueAction.IMAGE_UPLOAD;
}
// function retryAt(attempts: number) {
//   const delay = Math.min(
//     BASE_RETRY_DELAY_MS * 2 ** Math.max(attempts - 1, 0),
//     30 * 60_000,
//   );
//   return Date.now() + delay + jitter();
// }
function retryOrDeadLetter(task: TaskQueueTask) {
  if (task.attempts >= task.maxAttempts) {
    // DEAD_LETTER_QUEUE.push(task);
    deadLetterQueue.add('dead-letter', task, {
      removeOnComplete: {
        age: 3600,
      },
      removeOnFail: {
        age: 24 * 3600,
      },
    });
    return;
  }
  // RETRY_QUEUE.push({ ...task, nextAttemptAt: retryAt(task.attempts) });
}
async function flushRedirectStatsQueue() {
  const tasks = TASK_QUEUE.splice(0);
  await processTaskBatch(tasks);
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
    await Promise.all(SUBSCRIBERS[task.event].map((t) => t(attemptedTask)));
    console.log(
      `Thumbnail task completed for user ${task.data.id} by ${workerName}`,
    );
  } catch (e) {
    console.error(`Thumbnail task failed for user ${task.data.id}`);
    console.error(e);
    retryOrDeadLetter(attemptedTask);
  }
}
// function jitter() {
//   return Math.random() * 5_000;
// }

// async function retryQueueWorker() {
//   const now = Date.now();
//   const dueTasks = RETRY_QUEUE.filter((task) => task.nextAttemptAt <= now);
//   const waitingTasks = RETRY_QUEUE.filter((task) => task.nextAttemptAt > now);
//   RETRY_QUEUE.length = 0;
//   RETRY_QUEUE.push(...waitingTasks);
//   retryQueue.add(
//     'retry',
//     { ...waitingTasks },
//     {
//       attempts: 5,
//       backoff: {
//         type: 'exponential',
//         delay: 60_000,
//       },
//     },
//   );
//   await processTaskBatch(dueTasks);
// }
async function processTaskBatch(tasks: TaskQueueTask[]) {
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

  for (const task of tasks) {
    if (task.attempts >= task.maxAttempts) {
      DEAD_LETTER_QUEUE.push(task);
    } else if (isImageUploadTask(task)) {
      if (!task.taskId) {
        imageTasks.push({
          ...task,
          attempts: task.attempts + 1,
          taskId: `${task.data.id}_${randomUUID()}`,
        });
      } else {
        imageTasks.push({ ...task, attempts: task.attempts + 1 });
      }
    } else {
      const attemptedTask = {
        ...task,
        attempts: task.attempts + 1,
      };
      statsByCode[task.data.shortCode] = statsByCode[task.data.shortCode] ?? [];
      statsByCode[task.data.shortCode].push(attemptedTask);
    }
  }

  await Promise.all(
    Object.entries(statsByCode).map(async ([shortCode, tasks]) => {
      try {
        await incrementRedirectStats({
          tasks,
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
        const subscribers = SUBSCRIBERS[task.event];
        const subscriberIndexes =
          task.subscriberIndex === undefined
            ? subscribers.map((_, index) => index)
            : [task.subscriberIndex];
        const responses = await Promise.allSettled(
          subscriberIndexes.map((index) => subscribers[index](task)),
        );
        responses.forEach((result, responseIndex) => {
          if (result.status === 'rejected') {
            const subscriberIndex = subscriberIndexes[responseIndex];
            console.error(
              `Subscriber ${subscriberIndex} failed for user ${task.data.id}`,
              result.reason,
            );
            retryOrDeadLetter({ ...task, subscriberIndex });
          }
        });
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
async function deadLetterQueueWorker() {
  const tasks = DEAD_LETTER_QUEUE.splice(0);
  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      const { error } = await resend.emails.send({
        from: 'DLQ Monitor <onboarding@resend.dev>',
        to: [config.DLQ_ALERT_EMAIL!],
        subject: `Dead-letter task ${task?.taskId}`,
        html: `
        <h2>Task moved to dead-letter queue</h2>
        <p><strong>Task ID:</strong> ${task?.taskId}</p>
        <p><strong>Event:</strong> ${task?.event}</p>
        <p><strong>Attempts:</strong> ${task?.attempts}</p>
        <pre>${JSON.stringify(task, null, 2)}</pre>
      `,
        headers: {
          'Idempotency-Key': `dlq-alert:${task.taskId}`,
        },
      });
      if (error) throw new Error(error.message);
    }),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      DEAD_LETTER_QUEUE.push(tasks[i]);
    }
  });
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
  // retryQueueWorker,
  deadLetterQueueWorker,
};
