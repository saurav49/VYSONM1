import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { Request } from 'express';
import { redis } from '../config/redis';
const bcrypt = require('bcrypt');

const FIFO_QUEUE_KEY = 'cache:fifo:shortCodes';
const MAX_CACHE_SIZE = 1000;

async function deleteCache(code: string) {
  await redis.del(`shortCode:${code}`);
}
async function setCache({
  code,
  originalUrl,
}: {
  code: string;
  originalUrl: string;
}) {
  const cachedKey = `shortCode:${code}`;
  await redis.set(cachedKey, originalUrl, 'EX', 3600);
}
async function setCacheFIFO({
  code,
  originalUrl,
}: {
  code: string;
  originalUrl: string;
}) {
  const cachedKey = `shortCode:${code}`;
  const exists = await redis.exists(cachedKey);

  await redis.set(cachedKey, originalUrl);

  if (!exists) {
    await redis.rpush(FIFO_QUEUE_KEY, cachedKey);
  }
  const size = await redis.llen(FIFO_QUEUE_KEY);
  if (size > MAX_CACHE_SIZE) {
    const oldestKey = await redis.rpop(FIFO_QUEUE_KEY);
    if (oldestKey) {
      await deleteCache(oldestKey);
    }
  }
}
async function getCache(code: string) {
  return await redis.get(`shortCode:${code}`);
}
const isValidEmail = (email: string) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};
const isValidDateTime = (value: string) => {
  const timestamp = Date.parse(value);
  return !isNaN(timestamp);
};
const handleCreateUrlShortener = async ({
  originalUrl,
  expiryDate,
  code,
  req,
  hashedPassword,
}: {
  originalUrl: string;
  expiryDate?: string;
  code?: string;
  req: Request;
  hashedPassword?: string;
}) => {
  try {
    const now = new Date().getTime();
    const parsedExpiryDate = expiryDate ? new Date(expiryDate) : null;
    if (!originalUrl) {
      return {
        statusCode: 400,
        body: {
          status: false,
          message: 'Original url is required',
        },
      };
    }
    if (expiryDate && !isValidDateTime(expiryDate)) {
      return {
        statusCode: 400,
        body: {
          status: false,
          message: 'Invalid Expiry date',
        },
      };
    }
    if (parsedExpiryDate && now > parsedExpiryDate.getTime()) {
      return {
        statusCode: 400,
        body: {
          status: false,
          message: 'Past expiry date is invalid',
        },
      };
    }
    const isValidUrl = URL.canParse(originalUrl);
    if (!isValidUrl) {
      return {
        statusCode: 400,
        body: {
          status: false,
          message: 'Invalid url',
        },
      };
    }
    const user = (req as any).user;
    if (code) {
      const response = await prisma.urlShortener.findUnique({
        where: {
          shortCode: code,
        },
      });
      if (response && response.id) {
        return {
          statusCode: 409,
          body: {
            status: false,
            message: 'Short code already present, please try another one',
          },
        };
      }
    }
    const shortCode = code ?? randomBytes(8).toString('base64url').slice(0, 10);
    const response = await prisma.urlShortener.create({
      data: {
        originalUrl,
        shortCode,
        userId: user.id,
        expiryDate: parsedExpiryDate,
        password: hashedPassword,
      },
    });
    if (!response?.password && !response?.expiryDate) {
      await setCache({ code: response.shortCode as string, originalUrl });
    }
    return {
      statusCode: 201,
      body: {
        status: true,
        data: {
          originalUrl: response.originalUrl,
          shortCode: response.shortCode,
        },
      },
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: {
        status: false,
        message: e,
      },
    };
  }
};
async function hashPassword(password: string) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}
export {
  isValidEmail,
  isValidDateTime,
  handleCreateUrlShortener,
  hashPassword,
  deleteCache,
  setCache,
  getCache,
  setCacheFIFO,
};
