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
      message: 'Unauthorized access, cannot edit',
    });
  }
  (req as any).user = user;
  next();
}

export { errorHandler, loggerHandler, authHandler };
