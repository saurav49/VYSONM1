import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import {
  DEAD_LETTER,
  DEFAULT_DEAD_LETTER_QUEUE_CONFIG,
  DEFAULT_QUEUE_CONFIG,
  IMAGE_PROCESSING,
  NOTIFICATIONS,
  REDIRECT_STATS,
} from './constants';
import { incrementRedirectStats } from '../modules/short-codes/short-codes.repository';
import { deadLetterQueue, notificationQueue } from './queue';
import { generateThumbnail, notifyAdmin, sendWebhookDataHandler } from './util';
import { config } from '../config/env';
import { Resend } from 'resend';
const resend = new Resend(config.RESEND_API_KEY);

function redirectStatsWorker() {
  return new Worker(
    REDIRECT_STATS,
    async (job) => {
      try {
        await incrementRedirectStats({
          taskId: job.data.taskId,
          shortCode: job.data.data.shortCode,
          event: job.data.event,
        });
        await sendWebhookDataHandler();
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    {
      connection: redis,
      autorun: true,
    },
  );
}

function imageProcessingWorker() {
  return new Worker(
    IMAGE_PROCESSING,
    async (job) => {
      try {
        await generateThumbnail({
          event: job.data.event,
          data: job.data.data,
          taskId: job.data.taskId,
        });
        await notificationQueue.add(
          'notification',
          {
            taskId: job.data.taskId,
          },
          {
            ...DEFAULT_QUEUE_CONFIG,
            jobId: `${job.data.taskId}:notification`,
          },
        );
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    {
      connection: redis,
      autorun: true,
    },
  );
}

function notificationWorker() {
  return new Worker(
    NOTIFICATIONS,
    async (_job) => {
      try {
        await notifyAdmin();
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    {
      connection: redis,
      autorun: true,
    },
  );
}

function deadLetterWorker() {
  return new Worker(
    DEAD_LETTER,
    async (job) => {
      const { error } = await resend.emails.send({
        from: 'DLQ Monitor <onboarding@resend.dev>',
        to: [config.DLQ_ALERT_EMAIL!],
        subject: `Dead-letter task ${job.data?.taskId}`,
        html: `
        <h2>Task moved to dead-letter queue</h2>
        <p><strong>Task ID:</strong> ${job.data?.taskId}</p>
        <p><strong>Event:</strong> ${job.data?.data.event}</p>
        <pre>${JSON.stringify(job, null, 2)}</pre>
      `,
        headers: {
          'Idempotency-Key': `dlq-alert:${job?.data.taskId}`,
        },
      });
      if (error) throw error;
    },
    {
      connection: redis,
      autorun: true,
      ...DEFAULT_DEAD_LETTER_QUEUE_CONFIG,
    },
  );
}

function moveExhaustedJobToDeadLetterQueue(worker: Worker) {
  worker.on('failed', async (job, error) => {
    try {
      if (!job) return;

      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade < maxAttempts) return;

      await deadLetterQueue.add(
        'dead-letter-alert',
        {
          sourceQueue: worker.name,
          taskId: job?.data?.taskId,
          jobName: job.name,
          data: job.data,
          attempts: job.attemptsMade,
          error: error.message,
        },
        {
          ...DEFAULT_DEAD_LETTER_QUEUE_CONFIG,
          jobId: `dlq:${worker.name}:${job.id}`,
        },
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
}

function startWorkers() {
  const redirectWorker = redirectStatsWorker();
  const imageWorker = imageProcessingWorker();
  const notficationProcessingWorker = notificationWorker();
  const deadLetterInstanceWorker = deadLetterWorker();

  moveExhaustedJobToDeadLetterQueue(redirectWorker);
  moveExhaustedJobToDeadLetterQueue(imageWorker);
  moveExhaustedJobToDeadLetterQueue(notficationProcessingWorker);

  return [
    redirectWorker,
    imageWorker,
    notficationProcessingWorker,
    deadLetterInstanceWorker,
  ];
}

const workers = startWorkers();

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down workers...`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await redis.quit();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

for (const worker of workers) {
  worker.on('error', (error) => {
    console.error(`Worker ${worker.name} error`, error);
  });
}

console.log('BullMQ workers started');

export {
  redirectStatsWorker,
  imageProcessingWorker,
  deadLetterWorker,
  notificationWorker,
};
