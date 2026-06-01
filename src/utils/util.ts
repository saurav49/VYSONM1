import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { Request, Response, NextFunction } from 'express';
const bcrypt = require('bcrypt');

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
};
