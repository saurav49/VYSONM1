import path from 'path';
import { prisma } from '../lib/prisma';
import fs from 'fs/promises';
import sharp from 'sharp';

async function fetchAllUsersWithFile() {
  return await prisma.user.findMany({
    where: {
      file: {
        not: null,
      },
      thumbnail: null,
    },
  });
}

export async function addThumbnail() {
  try {
    const users = await fetchAllUsersWithFile();
    for (const user of users) {
      if (user?.file && !user?.thumbnail) {
        const env = process.env.NODE_ENV ?? 'dev';
        const outputDir = path.join(process.cwd(), 'public', 'thumbnail', env);
        await fs.mkdir(outputDir, { recursive: true });

        const uniqueName = Date.now() + '-' + `${user?.id}`;
        const outputPath = path.join(outputDir, `${uniqueName}.jpg`);

        await sharp(user.file)
          .resize(300, 300)
          .jpeg({ quality: 90 })
          .toFile(outputPath);

        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            thumbnail: outputPath,
          },
        });
      }
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
}
