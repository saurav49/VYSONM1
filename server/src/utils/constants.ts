import { Response } from 'express';
import { TaskQueueAction } from './enums';

const PAGE_SIZE = 10;
const ALLOWED_FILE_TYPE = ['image/jpeg', 'image/png', 'image/webp'];
const FIFO_QUEUE_KEY = 'cache:fifo:shortCodes';
const MAX_CACHE_SIZE = 1000;
// Five retries after the initial execution: 1 initial attempt + 5 retries.
const MAX_RETRY_ATTEMPTS = 5;
const MAX_TASK_ATTEMPTS = MAX_RETRY_ATTEMPTS + 1;
const BASE_RETRY_DELAY_MS = 60_000;

type GenerateThumbnailTask = {
  imagePath: string;
  file: string;
  id: number;
};

type IncrementStatsTask = {
  shortCode: string;
};

type ImageUploadQueueTask = {
  event: TaskQueueAction.IMAGE_UPLOAD;
  data: GenerateThumbnailTask;
  subscriberIndex?: number;
  taskId: string;
};

type IncrementStatsQueueTask = {
  event: TaskQueueAction.INCREMENT_REDIRECT_STATS;
  data: IncrementStatsTask;
  taskId: string;
};

type TaskQueueTask = ImageUploadQueueTask | IncrementStatsQueueTask;

const SSE_CLIENTS = new Set<Response>();

const REDIRECT_STATS = 'redirect-stats';
const IMAGE_PROCESSING = 'image-processing';
const NOTIFICATIONS = 'notifications';
const DEAD_LETTER = 'dead-letter';

const DEFAULT_QUEUE_CONFIG = {
  removeOnComplete: {
    age: 3600,
  },
  removeOnFail: {
    age: 24 * 3600,
  },
  attempts: MAX_TASK_ATTEMPTS,
  backoff: {
    type: 'exponential',
    delay: 60_000,
  },
};
const DEFAULT_DEAD_LETTER_QUEUE_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 10_000,
  },
};
export {
  PAGE_SIZE,
  ALLOWED_FILE_TYPE,
  FIFO_QUEUE_KEY,
  MAX_CACHE_SIZE,
  MAX_TASK_ATTEMPTS,
  MAX_RETRY_ATTEMPTS,
  SSE_CLIENTS,
  BASE_RETRY_DELAY_MS,
  REDIRECT_STATS,
  IMAGE_PROCESSING,
  NOTIFICATIONS,
  DEAD_LETTER,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_DEAD_LETTER_QUEUE_CONFIG,
};
export type {
  TaskQueueTask,
  IncrementStatsTask,
  ImageUploadQueueTask,
  IncrementStatsQueueTask,
};
