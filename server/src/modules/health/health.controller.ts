import { Request, Response } from 'express';
import { HTTP_STATUS } from '../../shared/constants/httpStatus';
import { successResponse } from '../../shared/responses/apiResponse';
import { checkDatabase } from './health.service';

function ping(_req: Request, res: Response) {
  return res
    .status(HTTP_STATUS.OK)
    .json(successResponse(undefined, 'Server up and running'));
}

async function health(_req: Request, res: Response) {
  try {
    await checkDatabase();

    return res.status(HTTP_STATUS.OK).json({
      status: true,
      database: 'CONNECTED',
    });
  } catch (error) {
    console.error(error);

    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      status: false,
      database: 'DOWN',
    });
  }
}

export { health, ping };
