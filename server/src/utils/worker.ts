import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import {
  DEAD_LETTER,
  IMAGE_PROCESSING,
  NOTIFICATIONS,
  REDIRECT_STATS,
} from './constants';

const redirectStatsWorker = new Worker(
  REDIRECT_STATS,
  async (job) =>
    await new Promise((resolve, _reject) =>
      setTimeout(() => resolve(console.log('processing job', job)), 3000),
    ),
  {
    connection: redis,
  },
);
const imageProcessingWorker = new Worker(
  IMAGE_PROCESSING,
  async (job) =>
    await new Promise((resolve, _reject) =>
      setTimeout(() => resolve(console.log('processing job', job)), 3000),
    ),
  {
    connection: redis,
  },
);
const notificationWorker = new Worker(
  NOTIFICATIONS,
  async (job) =>
    await new Promise((resolve, _reject) =>
      setTimeout(() => resolve(console.log('processing job', job)), 3000),
    ),
  {
    connection: redis,
  },
);
const deadLetterWorker = new Worker(
  DEAD_LETTER,
  async (job) =>
    await new Promise((resolve, _reject) =>
      setTimeout(() => resolve(console.log('processing job', job)), 3000),
    ),
  {
    connection: redis,
  },
);

export {
  redirectStatsWorker,
  imageProcessingWorker,
  notificationWorker,
  deadLetterWorker,
};
