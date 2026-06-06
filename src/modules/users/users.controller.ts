import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../../shared/constants/httpStatus';
import { successResponse } from '../../shared/responses/apiResponse';
import {
  createNewUser,
  deleteUser,
  getPaginatedUserShortList,
  getUserShortList,
} from './users.service';

function getUserApiKey(req: Request) {
  return req.user?.apiKey as string;
}

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createNewUser(req.body);

    return res.status(HTTP_STATUS.CREATED).json(successResponse(data));
  } catch (error) {
    console.error(error);
    return next(error);
  }
}

async function shortList(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getUserShortList(getUserApiKey(req));

    return res.status(HTTP_STATUS.OK).json(successResponse(data));
  } catch (error) {
    return next(error);
  }
}

async function paginatedShortList(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getPaginatedUserShortList({
      apiKey: getUserApiKey(req),
      page: req.query.page,
    });

    return res.status(HTTP_STATUS.OK).json(successResponse(data));
  } catch (error) {
    return next(error);
  }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteUser(getUserApiKey(req));

    return res.status(HTTP_STATUS.OK).json(successResponse());
  } catch (error) {
    return next(error);
  }
}

export { create, paginatedShortList, remove, shortList };
