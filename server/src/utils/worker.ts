import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import {
  DEAD_LETTER,
  DEFAULT_DEAD_LETTER_QUEUE_CONFIG,
  DEFAULT_QUEUE_CONFIG,
  IMAGE_PROCESSING,
  IMAGE_AGGREGATION_TIMEOUT,
  IMAGE_SAFETY,
  INVENTORY_PROCESSING,
  NOTIFICATIONS,
  ORDER_PROCESSING,
  REDIRECT_STATS,
} from './constants';
import { incrementRedirectStats } from '../modules/short-codes/short-codes.repository';
import { deadLetterQueue, imageSafetyQueue } from './queue';
import {
  generateThumbnail,
  handleImageAggregationTimeout,
  markImageStepCompleted,
  notifyAdmin,
  sendWebhookDataHandler,
} from './util';
import { config } from '../config/env';
import { Resend } from 'resend';
import { TaskQueueAction } from './enums';
import { reserveInventoryExactlyOnce } from '../modules/inventory/inventory.repository';
const resend = new Resend(config.RESEND_API_KEY);

function fraudDetectionService() {
  return new Worker(ORDER_PROCESSING, async (job) => {
    try {
      console.log(
        `processing order ${JSON.stringify(job)} for fraud detection`,
      );
      const event = job.data;

      if (event.event !== TaskQueueAction.ORDER_PLACED) return;
      if (event.eventVersion < 2) {
        throw new Error(
          `Fraud detection requires OrderPlaced v2; received v${event.eventVersion}`,
        );
      }
      // processing v2 task
      return;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
}

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
        await markImageStepCompleted(
          job.data.taskId,
          job.data.data.userId,
          'thumbnail',
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
function imageSafetyWorker() {
  return new Worker(
    IMAGE_SAFETY,
    async (job) => {
      try {
        console.log(`Image safety check done`);
        await markImageStepCompleted(
          job.data.taskId,
          job.data.data.userId,
          'safety',
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

function imageAggregationTimeoutWorker() {
  return new Worker(
    IMAGE_AGGREGATION_TIMEOUT,
    async (job) => {
      await handleImageAggregationTimeout(job.data.taskId, job.data.userId);
    },
    { connection: redis, autorun: true },
  );
}

function inventoryProcessingWorker() {
  return new Worker(
    INVENTORY_PROCESSING,
    async (job) => {
      if (job.data.event !== TaskQueueAction.INVENTORY_RESERVE_REQUESTED) return;

      return reserveInventoryExactlyOnce({
        eventId: job.data.eventId,
        orderId: job.data.orderId,
        sku: job.data.sku,
        quantity: job.data.quantity,
      });
    },
    { connection: redis, autorun: true },
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
  const fraudDetectionWorker = fraudDetectionService();
  const imageSafetyProcessingWorker = imageSafetyWorker();
  const imageTimeoutWorker = imageAggregationTimeoutWorker();
  const inventoryWorker = inventoryProcessingWorker();

  moveExhaustedJobToDeadLetterQueue(redirectWorker);
  moveExhaustedJobToDeadLetterQueue(imageWorker);
  moveExhaustedJobToDeadLetterQueue(notficationProcessingWorker);
  moveExhaustedJobToDeadLetterQueue(fraudDetectionWorker);
  moveExhaustedJobToDeadLetterQueue(imageSafetyProcessingWorker);
  moveExhaustedJobToDeadLetterQueue(imageTimeoutWorker);
  moveExhaustedJobToDeadLetterQueue(inventoryWorker);

  return [
    redirectWorker,
    imageWorker,
    notficationProcessingWorker,
    deadLetterInstanceWorker,
    fraudDetectionWorker,
    imageSafetyProcessingWorker,
    imageTimeoutWorker,
    inventoryWorker,
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
  imageAggregationTimeoutWorker,
  inventoryProcessingWorker,
};
