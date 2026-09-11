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

/**
 * Unit tests exercise orchestration through injected dependencies and should
 * not need a Redis daemon merely to import the application.  Keep the queue
 * surface used by the services, while real environments retain BullMQ.
 */
const createQueue = (name: string) => {
  if (process.env.NODE_ENV === 'test') {
    return { add: async () => undefined } as unknown as Pick<Queue, 'add'>;
  }

  return new Queue(name, { connection: redis });
};

const redirectStatsQueue = createQueue(REDIRECT_STATS);
const imageProcessingQueue = createQueue(IMAGE_PROCESSING);
const imageSafetyQueue = createQueue(IMAGE_SAFETY);
const imageAggregationTimeoutQueue = createQueue(IMAGE_AGGREGATION_TIMEOUT);
const notificationQueue = createQueue(NOTIFICATIONS);
const deadLetterQueue = createQueue(DEAD_LETTER);
const orderProcessingQueue = createQueue(ORDER_PROCESSING);
const inventoryProcessingQueue = createQueue(INVENTORY_PROCESSING);

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
