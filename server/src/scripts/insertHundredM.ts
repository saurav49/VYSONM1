import { nanoid } from 'nanoid';
import { prisma } from '../db/prisma';

const TOTAL_ROWS = 100_000_000;
const BATCH_SIZE = 10_000;
const LOG_EVERY_ROWS = 100_000;
const MAX_RETRY_ATTEMPTS = 5;

type InsertRow = {
  originalUrl: string;
  shortCode: string;
};

function buildRows(start: number, count: number): InsertRow[] {
  return Array.from({ length: count }, (_, index) => {
    const rowNumber = start + index;

    return {
      originalUrl: `https://google.com/${rowNumber}`,
      shortCode: nanoid(10),
    };
  });
}

async function insertBatch(tx: typeof prisma, rows: InsertRow[]) {
  const placeholders: string[] = [];
  const params: string[] = [];

  rows.forEach((row, index) => {
    const originalUrlParam = index * 2 + 1;
    const shortCodeParam = index * 2 + 2;

    placeholders.push(`($${originalUrlParam}, $${shortCodeParam})`);
    params.push(row.originalUrl, row.shortCode);
  });

  const result = await tx.$queryRawUnsafe<{ originalUrl: string }[]>(
    `
      INSERT INTO "UrlShortener" ("originalUrl", "shortCode")
      VALUES ${placeholders.join(', ')}
      ON CONFLICT ("shortCode") DO NOTHING
      RETURNING "originalUrl"
    `,
    ...params,
  );

  const insertedUrls = new Set(
    result.map((row: { originalUrl: string }) => row.originalUrl),
  );

  return rows.filter((row) => !insertedUrls.has(row.originalUrl));
}

async function insertWithRetries(tx: typeof prisma, rows: InsertRow[]) {
  let pendingRows = rows;
  let attempts = 0;
  let inserted = 0;

  while (pendingRows.length > 0 && attempts <= MAX_RETRY_ATTEMPTS) {
    const failedRows = await insertBatch(tx, pendingRows);
    inserted += pendingRows.length - failedRows.length;

    pendingRows = failedRows.map((row) => ({
      ...row,
      shortCode: nanoid(10),
    }));
    attempts += 1;
  }

  if (pendingRows.length > 0) {
    throw new Error(
      `Failed to insert ${pendingRows.length} rows after ${MAX_RETRY_ATTEMPTS} retries`,
    );
  }

  return inserted;
}

async function insertHundredM() {
  const start = performance.now();
  let totalInserted = 0;

  try {
    for (let offset = 0; offset < TOTAL_ROWS; offset += BATCH_SIZE) {
      const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_ROWS - offset);
      const rows = buildRows(offset, currentBatchSize);

      totalInserted += await prisma.$transaction((tx) =>
        insertWithRetries(tx as typeof prisma, rows),
      );

      if (
        totalInserted % LOG_EVERY_ROWS === 0 ||
        totalInserted === TOTAL_ROWS
      ) {
        const elapsedSeconds = ((performance.now() - start) / 1000).toFixed(2);
        console.log(
          `Inserted ${totalInserted.toLocaleString()} / ${TOTAL_ROWS.toLocaleString()} rows in ${elapsedSeconds}s`,
        );
      }
    }

    const elapsedSeconds = ((performance.now() - start) / 1000).toFixed(2);
    console.log(
      `Inserted ${totalInserted.toLocaleString()} rows successfully in ${elapsedSeconds}s`,
    );
    process.exit(0);
  } catch (error) {
    console.error('Failed to insert rows', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

insertHundredM();
