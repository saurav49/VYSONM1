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

v2Routes.use(v2UsersRouter);

Sentry.setupExpressErrorHandler(app);
app.use(errorMiddleware);

export default app;
