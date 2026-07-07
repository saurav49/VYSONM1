import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../../shared/constants/httpStatus';
import { successResponse } from '../../shared/responses/apiResponse';
import { getAnalytics } from './analytics.service';
import { broadcastSSELeaderboard } from '../../utils/util';
import { SSE_CLIENTS } from '../../utils/constants';

async function analytics(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAnalytics();

    return res.status(HTTP_STATUS.OK).json(successResponse(data));
  } catch (error) {
    console.error(error);
    return next(error);
  }
}
async function analyticsEvents(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();
    SSE_CLIENTS.add(res);

    broadcastSSELeaderboard();
    req.on('close', () => {
      SSE_CLIENTS.delete(res);
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
}

export { analytics, analyticsEvents };
