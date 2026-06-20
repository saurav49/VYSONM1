import { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { Tier } from './enums';
import path from 'path';
import { readFile, stat } from 'node:fs/promises';
import { AppError } from '../shared/errors/AppError';
import { errorResponse } from '../shared/responses/apiResponse';
import { HTTP_STATUS } from '../shared/constants/httpStatus';

let blacklistCache: {
  fileUpdatedAt: number;
  apiKeys: Set<string>;
} | null = null;

import { freeTierLimiter } from '../config/limiter';
function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status =
    err instanceof AppError
      ? err.statusCode
      : err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal Server Error';

  res.status(status).json(errorResponse(message));
}
async function loggerHandler(req: Request, _res: Response, next: NextFunction) {
  void prisma.requestLogging
    .create({
      data: {
        method: req?.method,
        timestamp: new Date(),
        userAgent: req['headers']['user-agent'],
        url: req?.originalUrl || req?.url,
        ip: req?.ip,
      },
    })
    .catch((e) => console.error(e));
  next();
}
async function authHandler(req: Request, res: Response, next: NextFunction) {
  const xApiKey = req.headers['x-api-key'];
  if (!xApiKey) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse('X API Key missing'));
  }
  const user = await prisma.user.findUnique({
    where: {
      apiKey: xApiKey as string,
    },
  });
  if (!user) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse('Unauthorized access'));
  }
  req.user = user;
  next();
}
async function tierHandler(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse('Unauthorized access'));
  }
  if (user.tier !== Tier.ENTERPRISE) {
    return res
      .status(HTTP_STATUS.FORBIDDEN)
      .json(errorResponse('Please upgrade to enterprise plan to batch insert'));
  }
  next();
}
async function getBlacklistAPIKeys(filePath: string) {
  const fileStat = await stat(filePath);
  const fileUpdatedAt = fileStat.mtimeMs;

  if (blacklistCache && blacklistCache.fileUpdatedAt === fileUpdatedAt) {
    return blacklistCache.apiKeys;
  }

  const data = await readFile(filePath, 'utf8');
  const apiKeys = new Set(
    data
      .split('\n')
      .map((apiKey) => apiKey.trim())
      .filter(Boolean),
  );

  blacklistCache = {
    fileUpdatedAt,
    apiKeys,
  };

  return apiKeys;
}
async function blacklistHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const clientXAPIKey = req.headers['x-api-key'];
  if (!clientXAPIKey) {
    return next();
  }
  try {
    const filePath = path.join(process.cwd(), 'src', 'config', 'blacklist.txt');
    const blacklistAPIKeys = await getBlacklistAPIKeys(filePath);

    if (blacklistAPIKeys.has(clientXAPIKey as string)) {
      return res
        .status(HTTP_STATUS.FORBIDDEN)
        .json(errorResponse('Unauthorized access'));
    }
    next();
  } catch (e) {
    console.error(e);
    next();
  }
}
async function apiRequestTimeHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const startTime = Date.now();
  const originalWriteHead = res.writeHead;

  res.setHeader('X-Response-Start-Time', new Date(startTime).toISOString());
  res.writeHead = function (...args: any[]) {
    const timeElapsed = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${timeElapsed}ms`);
    return originalWriteHead.apply(this, args as any);
  };
  next();
}
function timeMiddlewareHandler(name: string, middleware: any): RequestHandler {
  return async (req, res, next) => {
    const startTime = new Date();

    function done(e?: any) {
      const endTime = new Date();
      const timeElapsed = endTime.getTime() - startTime.getTime();
      // console.log(`${name} took ${timeElapsed}ms`);
      next(e);
    }

    try {
      middleware(req, res, done);
    } catch (e) {
      console.error(e);
      const endTime = new Date();
      const timeElapsed = endTime.getTime() - startTime.getTime();
      // console.log(`${name} took ${timeElapsed}ms`);
      next(e);
    }
  };
}
async function freeTierMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = req.user;
  if (!user) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse('Unauthorized access'));
  }
  return freeTierLimiter(req, res, next);
}
export {
  errorHandler,
  loggerHandler,
  authHandler,
  tierHandler,
  blacklistHandler,
  apiRequestTimeHandler,
  timeMiddlewareHandler,
  freeTierMiddleware,
};
