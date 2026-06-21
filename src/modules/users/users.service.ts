import crypto from 'crypto';
import { PAGE_SIZE, TASK_QUEUE } from '../../utils/constants';
import { isValidEmail, thumbnailImagePath } from '../../utils/util';
import { badRequest, unauthorized } from '../../shared/errors/httpErrors';
import {
  createUser,
  findUserWithPaginatedShortensByApiKey,
  findUserWithShortensByApiKey,
  softDeleteUserByApiKey,
  uploadf,
} from './users.repository';
import { CreateUserInput, User } from './users.types';
import { TaskQueueAction } from '../../utils/enums';
import { pb } from '../../utils/PubSub';

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

async function enqueueThumbnailTask({
  id,
  filePath,
}: {
  id: number;
  filePath: string;
}) {
  const outputPath = await thumbnailImagePath(id);
  pb.publish(TaskQueueAction.IMAGE_UPLOAD, {
    imagePath: outputPath,
    file: filePath,
    id,
  });
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

async function fileUpload(
  user: User | undefined,
  file: Express.Multer.File | undefined,
) {
  if (!user || !user?.id) {
    throw badRequest('Invalid user');
  }
  if (!file || !file?.path) {
    throw badRequest('File upload failed');
  }

  console.log(`Upload request received for user ${user.id}`);

  const res = await uploadf({
    id: user.id,
    path: file.path,
  });

  console.log(`Uploaded file saved for user ${user.id}: ${file.path}`);

  enqueueThumbnailTask({
    id: res.id,
    filePath: file.path,
  });

  console.log(`Thumbnail task queued for user ${user.id}`);
  console.log(
    `Returning upload response before thumbnail generation for user ${user.id}`,
  );

  return {
    message: 'File uploaded; thumbnail generation queued',
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
  enqueueThumbnailTask,
  getPaginatedUserShortList,
  getUserShortList,
  fileUpload,
};
