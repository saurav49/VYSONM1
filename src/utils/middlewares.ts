import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
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
  await prisma.requestLogging.create({
    data: {
      method: req?.method,
      timestamp: `${new Date()}`,
      userAgent: req['headers']['user-agent'],
      url: req?.originalUrl || req?.url,
      ip: req?.ip,
    },
  });
  next();
}

export { errorHandler, loggerHandler };
