import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { timeMiddlewareHandler } from '../../middlewares/request-time.middleware';
import { validateRequest } from '../../shared/validation/validateRequest';
import {
  create,
  paginatedShortList,
  remove,
  shortList,
} from './users.controller';
import { createUserSchema, userShortListSchema } from './users.schemas';
import { freeTierMiddleware } from '../../utils/middlewares';

const v1UsersRouter = Router();
const v2UsersRouter = Router();

v1UsersRouter.post('/users', validateRequest(createUserSchema), create);
v1UsersRouter.get(
  '/users/short-list',
  timeMiddlewareHandler('auth', authMiddleware),
  validateRequest(userShortListSchema),
  freeTierMiddleware,
  shortList,
);
v1UsersRouter.delete(
  '/users',
  timeMiddlewareHandler('auth', authMiddleware),
  freeTierMiddleware,
  remove,
);

v2UsersRouter.get(
  '/users/short-list',
  timeMiddlewareHandler('auth', authMiddleware),
  validateRequest(userShortListSchema),
  freeTierMiddleware,
  paginatedShortList,
);

export { v1UsersRouter, v2UsersRouter };
