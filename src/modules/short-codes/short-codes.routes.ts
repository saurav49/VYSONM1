import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tierMiddleware } from '../../middlewares/tier.middleware';
import { timeMiddlewareHandler } from '../../middlewares/request-time.middleware';
import { validateRequest } from '../../shared/validation/validateRequest';
import {
  batchCreateShortCodes,
  benchmarkShortCode,
  createShortCode,
  deleteShortCode,
  redirectShortCode,
  updateShortCode,
} from './short-codes.controller';
import {
  batchShortenSchema,
  createShortCodeSchema,
  patchShortCodeSchema,
  redirectShortCodeSchema,
} from './short-codes.schemas';

const shortCodesRouter = Router();

shortCodesRouter.post(
  '/shorten',
  timeMiddlewareHandler('auth', authMiddleware),
  validateRequest(createShortCodeSchema),
  createShortCode,
);
shortCodesRouter.patch(
  '/shorten',
  timeMiddlewareHandler('auth', authMiddleware),
  validateRequest(patchShortCodeSchema),
  updateShortCode,
);
shortCodesRouter.post(
  '/shorten/batch',
  timeMiddlewareHandler('auth', authMiddleware),
  timeMiddlewareHandler('tier', tierMiddleware),
  validateRequest(batchShortenSchema),
  batchCreateShortCodes,
);
shortCodesRouter.delete(
  '/short-codes/:code',
  timeMiddlewareHandler('auth', authMiddleware),
  deleteShortCode,
);
shortCodesRouter.get(
  '/redirect',
  validateRequest(redirectShortCodeSchema),
  redirectShortCode,
);
shortCodesRouter.post('/shorten-benchmark', benchmarkShortCode);

export { shortCodesRouter };
