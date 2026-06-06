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
import { redirectLimiter, shortenLimiter } from '../../config/limiter';
import { freeTierMiddleware } from '../../utils/middlewares';

const shortCodesRouter = Router();

shortCodesRouter.post(
  '/shorten',
  timeMiddlewareHandler('auth', authMiddleware),
  validateRequest(createShortCodeSchema),
  freeTierMiddleware,
  shortenLimiter,
  createShortCode,
);
shortCodesRouter.patch(
  '/shorten',
  timeMiddlewareHandler('auth', authMiddleware),
  validateRequest(patchShortCodeSchema),
  freeTierMiddleware,
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
  freeTierMiddleware,
  deleteShortCode,
);
shortCodesRouter.get(
  '/redirect',
  validateRequest(redirectShortCodeSchema),
  redirectLimiter,
  redirectShortCode,
);
shortCodesRouter.post('/shorten-benchmark', benchmarkShortCode);

export { shortCodesRouter };
