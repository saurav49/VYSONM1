import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../../shared/constants/httpStatus';
import { successResponse } from '../../shared/responses/apiResponse';
import { getAnalytics } from './analytics.service';

async function analytics(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAnalytics();

    return res.status(HTTP_STATUS.OK).json(successResponse(data));
  } catch (error) {
    console.error(error);
    return next(error);
  }
}

export { analytics };
