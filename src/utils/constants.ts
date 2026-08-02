import { TaskQueueAction } from './enums';

const PAGE_SIZE = 10;
const ALLOWED_FILE_TYPE = ['image/jpeg', 'image/png', 'image/webp'];
const FIFO_QUEUE_KEY = 'cache:fifo:shortCodes';
const MAX_CACHE_SIZE = 1000;

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
};

type IncrementStatsQueueTask = {
  event: TaskQueueAction.INCREMENT_REDIRECT_STATS;
  data: IncrementStatsTask;
};

type TaskQueueTask = ImageUploadQueueTask | IncrementStatsQueueTask;

const TASK_QUEUE: TaskQueueTask[] = [];

export {
  PAGE_SIZE,
  ALLOWED_FILE_TYPE,
  TASK_QUEUE,
  FIFO_QUEUE_KEY,
  MAX_CACHE_SIZE,
};
export type { TaskQueueTask };
