import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../../shared/constants/httpStatus';
import { successResponse } from '../../shared/responses/apiResponse';
import { unauthorized } from '../../shared/errors/httpErrors';
import {
  batchCreate,
  benchmark,
  create,
  redirect,
  remove,
  update,
} from './short-codes.service';
import { getCache } from '../../utils/util';

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw unauthorized('Unauthorized access');
  }

  return req.user;
}

async function createShortCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await create({
      user: getAuthenticatedUser(req),
      body: req.body,
    });

    return res.status(HTTP_STATUS.CREATED).json(successResponse(data));
  } catch (error) {
    return next(error);
  }
}

async function updateShortCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await update({
      user: getAuthenticatedUser(req),
      body: req.body,
    });

    return res.status(HTTP_STATUS.OK).json(successResponse(data));
  } catch (error) {
    return next(error);
  }
}

async function batchCreateShortCodes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await batchCreate({
      user: getAuthenticatedUser(req),
      body: req.body,
    });

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    return next(error);
  }
}

async function deleteShortCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await remove({
      user: getAuthenticatedUser(req),
      code: req.params.code as string | undefined,
    });
    return res.status(HTTP_STATUS.OK).json(successResponse());
  } catch (error) {
    return next(error);
  }
}

async function redirectShortCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const cachedValue = await getCache(req.query.code as string);
    if (cachedValue) {
      return res.redirect(cachedValue);
    }
    const originalUrl = await redirect({
      code: req.query.code,
      password: req.query.password,
    });

    return res.redirect(originalUrl);
  } catch (error) {
    return next(error);
  }
}

async function benchmarkShortCode(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await benchmark();

    return res.status(HTTP_STATUS.CREATED).json(data);
  } catch (error) {
    return next(error);
  }
}

export {
  batchCreateShortCodes,
  benchmarkShortCode,
  createShortCode,
  deleteShortCode,
  redirectShortCode,
  updateShortCode,
};
