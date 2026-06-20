import crypto from 'crypto';
import { PAGE_SIZE } from '../../utils/constants';
import { isValidEmail } from '../../utils/util';
import { badRequest, unauthorized } from '../../shared/errors/httpErrors';
import {
  createUser,
  findUserWithPaginatedShortensByApiKey,
  findUserWithShortensByApiKey,
  softDeleteUserByApiKey,
} from './users.repository';
import { CreateUserInput } from './users.types';

function mapShortens(shortens: any[]) {
  return shortens.map((shorten) => ({
    id: shorten.id,
    originalUrl: shorten.originalUrl,
    shortCode: shorten.shortCode,
    clicks: shorten.clicks,
    lastAccessedAt: shorten.lastAccessedAt,
    expiryDate: shorten.expiryDate,
  }));
}

async function createNewUser({ email, name }: CreateUserInput) {
  if (!email || !name) {
    throw unauthorized('Email and name are required');
  }

  if (!isValidEmail(email)) {
    throw unauthorized('Invalid email');
  }

  const apiKey = crypto.randomBytes(32).toString('hex');
  const result = await createUser({
    email,
    name,
    apiKey,
  });

  return {
    id: result.id,
    apiKey: result.apiKey,
  };
}

async function getUserShortList(apiKey: string) {
  const userWithUrls = await findUserWithShortensByApiKey(apiKey);

  if (!userWithUrls) {
    throw unauthorized('User not found');
  }

  return {
    id: userWithUrls.id,
    email: userWithUrls.email,
    name: userWithUrls.name,
    tier: userWithUrls.tier,
    shortens: mapShortens(userWithUrls.shortens),
  };
}

async function getPaginatedUserShortList({
  apiKey,
  page,
}: {
  apiKey: string;
  page?: unknown;
}) {
  if (!page) {
    throw badRequest('Page number required');
  }

  const pageNo = Number(page);
  if (!Number.isInteger(pageNo) || pageNo < 1) {
    throw badRequest('Page no should be positive');
  }

  const userWithUrls = await findUserWithPaginatedShortensByApiKey({
    apiKey,
    page: pageNo,
    pageSize: PAGE_SIZE,
  });

  if (!userWithUrls) {
    throw unauthorized('User not found');
  }

  return {
    id: userWithUrls.id,
    email: userWithUrls.email,
    name: userWithUrls.name,
    tier: userWithUrls.tier,
    shortens: mapShortens(userWithUrls.shortens),
    pagination: {
      page: pageNo,
      pageSize: PAGE_SIZE,
    },
  };
}

async function deleteUser(apiKey: string) {
  await softDeleteUserByApiKey(apiKey);
}

export {
  createNewUser,
  deleteUser,
  getPaginatedUserShortList,
  getUserShortList,
};
