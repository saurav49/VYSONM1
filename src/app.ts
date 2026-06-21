import './utils/instrument';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import express, { Router } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { healthRouter } from './modules/health/health.routes';
import { shortCodesRouter } from './modules/short-codes/short-codes.routes';
import { v1UsersRouter, v2UsersRouter } from './modules/users/users.routes';
import { blacklistMiddleware } from './middlewares/blacklist.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { loggerMiddleware } from './middlewares/logger.middleware';
import {
  requestTimeMiddleware,
  timeMiddlewareHandler,
} from './middlewares/request-time.middleware';
import { swaggerSpec } from './swagger';
import { limiter } from './config/limiter';
import {
  flushRedirectStatsQueue,
  generateThumbnail,
  options,
  sleep,
} from './utils/util';
import cron from 'node-cron';
import { TASK_QUEUE } from './utils/constants';
import { TaskQueueAction } from './utils/enums';

dotenv.config();

const app = express();
const v1Routes = Router();
const v2Routes = Router();

// only trust the proxy (that is one hop away)
app.set('trust proxy', 1);
app.use(limiter);
app.use(
  cors({
    origin: '*', // REMOVE IN PRODUCTION
  }),
);
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(timeMiddlewareHandler('logger', loggerMiddleware));
app.use(timeMiddlewareHandler('api-request-time', requestTimeMiddleware));
app.use(timeMiddlewareHandler('blacklist', blacklistMiddleware));

app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

v1Routes.use(healthRouter);
v1Routes.use(v1UsersRouter);
v1Routes.use(shortCodesRouter);
v1Routes.use(analyticsRouter);
v1Routes.get('/debug-sentry', () => {
  throw new Error('My first Sentry error!');
});

v2Routes.get('/sync', async (_req, res) => {
  console.log('SYNC REQUEST', new Date().toLocaleString('en-US', options));
  await sleep();
  console.log(
    'SYNC TASK COMPLETED',
    new Date().toLocaleString('en-US', options),
  );
  return res.status(200).json({
    status: true,
    message: 'done',
  });
});

v2Routes.get('/async', async (_req, res) => {
  console.log('ASYNC REQUEST', new Date().toLocaleString('en-US', options));
  sleep().then(() => {
    console.log(
      'ASYNC BACKGROUND TASK COMPLETED',
      new Date().toLocaleString('en-US', options),
    );
    console.log('Background task completed');
  });
  console.log(
    'ASYNC TASK COMPLETED',
    new Date().toLocaleString('en-US', options),
  );
  return res.status(200).json({
    status: true,
    message: 'Accepted',
  });
});

v2Routes.use(v2UsersRouter);
// WITHOUT QUEUE
// cron.schedule('* * * * *', async () => {
//   console.log('---------------------');
//   console.log('Running every minute cron job...');
//   await addThumbnail();
//   console.log('Task completed successfully.');
//   console.log('---------------------');
// });

// WITH QUEUE
cron.schedule('* * * * *', async () => {
  console.log('---------------------');
  console.log(
    `Running every minute cron job (${new Date().toDateString()}) ...`,
  );

  const remainingQueue = [];

  for (const task of TASK_QUEUE) {
    if (!task) {
      console.log('No queued tasks.');
      console.log('---------------------');
      return;
    }

    if (task.type === TaskQueueAction.GENERATE_THUMBNAIL) {
      try {
        console.log(`Picked thumbnail task for user ${task.id}`);
        if (task.imagePath && task.file && task.id) {
          await generateThumbnail({
            imagePath: task.imagePath,
            file: task.file,
            id: task.id,
          });
        }
        console.log(`Thumbnail task completed for user ${task.id}`);
      } catch (e) {
        console.error(`Thumbnail task failed for user ${task.id}`);
        console.error(e);
      }
    } else {
      remainingQueue.push(task);
    }
  }

  TASK_QUEUE.length = 0;
  TASK_QUEUE.push(...remainingQueue);

  console.log('---------------------');
});
cron.schedule('*/5 * * * *', async () => {
  console.log('---------------------');
  console.log(`Running cron (${new Date().toISOString()})`);

  await flushRedirectStatsQueue();

  console.log('---------------------');
});

Sentry.setupExpressErrorHandler(app);
app.use(errorMiddleware);

export default app;
