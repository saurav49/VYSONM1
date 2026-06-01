import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Tier } from './enums';
import path from 'path';
import { readFileSync } from 'node:fs';
function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
}
async function loggerHandler(req: Request, _res: Response, next: NextFunction) {
  await prisma.requestLogging
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
    return res.status(401).json({
      status: false,
      message: 'X API Key missing',
    });
  }
  const user = await prisma.user.findUnique({
    where: {
      apiKey: xApiKey as string,
    },
  });
  if (!user) {
    return res.status(401).json({
      status: false,
      message: 'Unauthorized access',
    });
  }
  (req as any).user = user;
  next();
}
async function tierHandler(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      status: false,
      message: 'Unauthorized access',
    });
  }
  if (user.tier !== Tier.ENTERPRISE) {
    return res.status(403).json({
      status: false,
      message: 'Please upgrade to enterprise plan to batch insert',
    });
  }
  next();
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
    const data = readFileSync(filePath, 'utf8');
    const blacklistAPIKey = data.split('\n');
    const isBlacklistAPIKeyFound = blacklistAPIKey.find(
      (r) => r.trim() === clientXAPIKey,
    );
    if (isBlacklistAPIKeyFound) {
      return res.status(403).json({
        status: false,
        message: 'Unauthorized access',
      });
    }
    next();
  } catch (e) {
    console.error(e);
    next();
  }
}
async function apiRequestTimeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const startTime = new Date();
  res.setHeader('X-Response-Start-Time', `${startTime}ms`);
  const originalJSON = res.json;

  res.json = function (body) {
    const endTime = new Date();
    const timeElapsed = endTime.getTime() - startTime.getTime();
    res.setHeader('X-Response-Time', `${timeElapsed}ms`);
    return originalJSON.call(this, body);
  };
  next();
}
export {
  errorHandler,
  loggerHandler,
  authHandler,
  tierHandler,
  blacklistHandler,
  apiRequestTimeHandler,
};

// [Q6] Store the start time when the request is passing through this new middleware. While coming back, see the end time and calculate the difference as the elapsed time. Add this to the response header.
