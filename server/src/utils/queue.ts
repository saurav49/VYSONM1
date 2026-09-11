import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import {
  DEAD_LETTER,
  IMAGE_PROCESSING,
  IMAGE_AGGREGATION_TIMEOUT,
  IMAGE_SAFETY,
  INVENTORY_PROCESSING,
  NOTIFICATIONS,
  ORDER_PROCESSING,
  REDIRECT_STATS,
} from './constants';

const redirectStatsQueue = new Queue(REDIRECT_STATS, { connection: redis });
const imageProcessingQueue = new Queue(IMAGE_PROCESSING, {
  connection: redis,
});
const imageSafetyQueue = new Queue(IMAGE_SAFETY, {
  connection: redis,
});
const imageAggregationTimeoutQueue = new Queue(IMAGE_AGGREGATION_TIMEOUT, {
  connection: redis,
});
const notificationQueue = new Queue(NOTIFICATIONS, { connection: redis });
const deadLetterQueue = new Queue(DEAD_LETTER, { connection: redis });
const orderProcessingQueue = new Queue(ORDER_PROCESSING, { connection: redis });
const inventoryProcessingQueue = new Queue(INVENTORY_PROCESSING, {
  connection: redis,
});

export {
  redirectStatsQueue,
  imageProcessingQueue,
  notificationQueue,
  deadLetterQueue,
  orderProcessingQueue,
  imageSafetyQueue,
  imageAggregationTimeoutQueue,
  inventoryProcessingQueue,
};
