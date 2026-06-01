import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Tier } from './enums';
import path from 'path';
import { readFile, readFileSync } from 'node:fs';
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
async function loggerHandler(req: Request, res: Response, next: NextFunction) {
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
  const filePath = path.join(process.cwd(), 'src', 'config', 'blacklist.txt');
  readFile(filePath, 'utf8', (_err, data) => {
    const clientIP = req?.ip;
    const blacklistIps = data.split('\n');
    const isBlacklistIPFound = blacklistIps.some((r) => r === clientIP);
    if (isBlacklistIPFound) {
      return res.status(403).json({
        status: false,
        message: 'Unauthorized access',
      });
    }
  });
  next();
}
export {
  errorHandler,
  loggerHandler,
  authHandler,
  tierHandler,
  blacklistHandler,
};
