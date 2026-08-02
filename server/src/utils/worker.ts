import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import {
  DEAD_LETTER,
  IMAGE_PROCESSING,
  NOTIFICATIONS,
  REDIRECT_STATS,
} from './constants';

let worker: Worker;

function redirectStatsWorker() {
  worker = new Worker(
    REDIRECT_STATS,
    async (job) => {
      try {
      } catch (e) {}
    },
    {
      connection: redis,
      autorun: true,
    },
  );
}

function imageProcessingWorker() {
  worker = new Worker(IMAGE_PROCESSING, async (job) => {}, {
    connection: redis,
    autorun: true,
  });
}

function deadLetterWorker() {
  worker = new Worker(DEAD_LETTER, async (job) => {}, {
    connection: redis,
    autorun: true,
  });
}

export { redirectStatsWorker, imageProcessingWorker, deadLetterWorker };
