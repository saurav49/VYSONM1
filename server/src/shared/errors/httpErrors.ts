import { HTTP_STATUS } from '../constants/httpStatus';
import { AppError } from './AppError';

const badRequest = (message: string) =>
  new AppError(HTTP_STATUS.BAD_REQUEST, message);

const unauthorized = (message = 'Unauthorized access') =>
  new AppError(HTTP_STATUS.UNAUTHORIZED, message);

const forbidden = (message = 'Forbidden action') =>
  new AppError(HTTP_STATUS.FORBIDDEN, message);

const notFound = (message = 'Resource not found') =>
  new AppError(HTTP_STATUS.NOT_FOUND, message);

const conflict = (message: string) =>
  new AppError(HTTP_STATUS.CONFLICT, message);

const internalServerError = (message = 'Internal Server Error') =>
  new AppError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);

const serviceUnavailable = (message = 'Service unavailable') =>
  new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, message);

export {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  serviceUnavailable,
  unauthorized,
};
