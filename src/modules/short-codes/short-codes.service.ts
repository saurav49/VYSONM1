import { randomBytes } from 'node:crypto';
import { UserModel } from '../../generated/prisma/models/User';
import { HTTP_STATUS } from '../../shared/constants/httpStatus';
import { AppError } from '../../shared/errors/AppError';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from '../../shared/errors/httpErrors';
import {
  errorResponse,
  successResponse,
} from '../../shared/responses/apiResponse';
import {
  deleteCache,
  flushRedirectStatsQueue,
  getCache,
  hashPassword,
  isValidDateTime,
  setCache,
} from '../../utils/util';
import {
  BatchCreateShortCodeBody,
  CreateShortCodeBody,
  PatchShortCodeBody,
} from './short-codes.types';
import {
  createShortCode as createShortCodeRecord,
  findActiveByShortCode,
  findByShortCode,
  findFirstUniqueCode,
  incrementRedirectStats,
  softDeleteShortCodeForUser,
  updateShortCodeForUser,
} from './short-codes.repository';
import { TASK_QUEUE } from '../../utils/constants';
import { TaskQueueAction } from '../../utils/enums';

const bcrypt = require('bcrypt');

function parseExpiryDate(expiryDate?: string) {
  if (!expiryDate) {
    return null;
  }

  if (!isValidDateTime(expiryDate)) {
    throw badRequest('Invalid Expiry date');
  }

  const parsedExpiryDate = new Date(expiryDate);
  if (Date.now() > parsedExpiryDate.getTime()) {
    throw badRequest('Past expiry date is invalid');
  }

  return parsedExpiryDate;
}

async function create({
  user,
  body,
}: {
  user: UserModel;
  body: CreateShortCodeBody;
}) {
  const { originalUrl, expiryDate, code, password } = body;

  if (!originalUrl) {
    throw badRequest('Original url is required');
  }

  if (!URL.canParse(originalUrl)) {
    throw badRequest('Invalid url');
  }

  const parsedExpiryDate = parseExpiryDate(expiryDate);

  if (code) {
    const existingShortCode = await findByShortCode(code);

    if (existingShortCode?.id) {
      throw conflict('Short code already present, please try another one');
    }
  }

  const shortCode = code ?? randomBytes(8).toString('base64url').slice(0, 10);
  const hashedPassword = password ? await hashPassword(password) : undefined;
  const response = await createShortCodeRecord({
    originalUrl,
    shortCode,
    userId: user.id,
    expiryDate: parsedExpiryDate,
    password: hashedPassword,
  });

  return {
    originalUrl: response.originalUrl,
    shortCode: response.shortCode,
  };
}

async function createResponse({
  user,
  body,
}: {
  user: UserModel;
  body: CreateShortCodeBody;
}) {
  try {
    const data = await create({ user, body });

    return {
      statusCode: HTTP_STATUS.CREATED,
      body: successResponse(data),
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        body: errorResponse(error.message),
      };
    }

    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      body: {
        status: false,
        message: error,
      },
    };
  }
}

async function update({
  user,
  body,
}: {
  user: UserModel;
  body: PatchShortCodeBody;
}) {
  const parsedExpiryDate = body.expiryDate
    ? new Date(body.expiryDate)
    : undefined;
  const hashedPassword = body.password
    ? await hashPassword(body.password)
    : undefined;
  const url = await findFirstUniqueCode({
    shortCode: body.code,
    userId: user.id,
  });
  if (!url) {
    return {
      statusCode: HTTP_STATUS.NOT_FOUND,
      body: {
        status: false,
        message: 'URL not found',
      },
    };
  }
  const result = await updateShortCodeForUser({
    shortCode: body.code,
    userId: user.id,
    expiryDate: parsedExpiryDate,
    password: hashedPassword,
  });

  if (result.count === 0) {
    throw forbidden('Forbidden action');
  }
  await deleteCache(body.code as string);
  return result;
}

async function batchCreate({
  user,
  body,
}: {
  user: UserModel;
  body: BatchCreateShortCodeBody;
}) {
  if (!body) {
    throw badRequest('Invalid request');
  }

  if (Array.isArray(body) && body.length > 0) {
    const results = await Promise.all(
      body.map((requestBody) =>
        createResponse({
          user,
          body: requestBody,
        }),
      ),
    );
    const statusCode = results.every(
      (result) => result.statusCode === HTTP_STATUS.CREATED,
    )
      ? HTTP_STATUS.CREATED
      : HTTP_STATUS.MULTI_STATUS;

    return {
      statusCode,
      body: {
        status: statusCode === HTTP_STATUS.CREATED,
        data: results,
      },
    };
  }

  throw badRequest('No batch data found');
}

async function remove({ user, code }: { user: UserModel; code?: string }) {
  if (!code) {
    throw badRequest('Code is required');
  }

  const result = await softDeleteShortCodeForUser({
    shortCode: code,
    userId: user.id,
  });

  if (result.count === 0) {
    throw forbidden('Forbidden action');
  }
  await deleteCache(code as string);
}

async function redirect({
  code,
  password,
}: {
  code?: unknown;
  password?: unknown;
}) {
  if (!code) {
    throw badRequest('Code is required');
  }

  const cachedUrl = await getCache(code as string);
  if (cachedUrl) {
    TASK_QUEUE.push({
      event: TaskQueueAction.INCREMENT_REDIRECT_STATS,
      data: { shortCode: code as string },
    });
    const incrementStatsQueue = TASK_QUEUE.filter(
      (t) => t.event === TaskQueueAction.INCREMENT_REDIRECT_STATS,
    );
    if (incrementStatsQueue.length > 100) {
      void flushRedirectStatsQueue();
    }
    return cachedUrl;
  }

  const result = await findActiveByShortCode(code as string);

  if (!result?.originalUrl) {
    throw notFound('URL not found');
  }

  if (result.password && !password) {
    throw unauthorized('Unauthorized access');
  }

  if (result.password && password) {
    const isMatch = await bcrypt.compare(password, result.password);

    if (!isMatch) {
      throw unauthorized('Unauthorized access');
    }
  }

  if (result.expiryDate && result.expiryDate.getTime() < Date.now()) {
    throw notFound('URL expired');
  }

  if (!result?.password && !result?.expiryDate) {
    await setCache({
      code: result.shortCode as string,
      originalUrl: result.originalUrl,
    });
  }

  TASK_QUEUE.push({
    event: TaskQueueAction.INCREMENT_REDIRECT_STATS,
    data: {
      shortCode: code as string,
    },
  });
  const incrementStatsQueue = TASK_QUEUE.filter(
    (t) => t.event === TaskQueueAction.INCREMENT_REDIRECT_STATS,
  );
  if (incrementStatsQueue.length > 100) {
    void flushRedirectStatsQueue();
  }

  return result.originalUrl;
}

async function benchmark() {
  const shortCode = randomBytes(8).toString('base64url').slice(0, 10);
  const originalUrl = `https://terminaltrove.com/oha/${Date.now()}-${shortCode}`;

  return createShortCodeRecord({
    originalUrl,
    shortCode,
    userId: undefined as any,
    expiryDate: null,
  });
}

export { batchCreate, benchmark, create, redirect, remove, update };
