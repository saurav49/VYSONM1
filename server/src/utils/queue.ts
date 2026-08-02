import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import {
  DEAD_LETTER,
  IMAGE_PROCESSING,
  NOTIFICATIONS,
  REDIRECT_STATS,
} from './constants';

const redirectStatsQueue = new Queue(REDIRECT_STATS, { connection: redis });
const imageProcessingQueue = new Queue(IMAGE_PROCESSING, {
  connection: redis,
});
const notificationQueue = new Queue(NOTIFICATIONS, { connection: redis });
const deadLetterQueue = new Queue(DEAD_LETTER, { connection: redis });

export {
  redirectStatsQueue,
  imageProcessingQueue,
  notificationQueue,
  deadLetterQueue,
};
