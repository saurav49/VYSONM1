import { z } from 'zod';

const createShortCodeBodySchema = z.object({
  originalUrl: z.string().optional(),
  expiryDate: z.string().optional(),
  code: z.string().optional(),
  password: z.string().optional(),
});

const createShortCodeSchema = z.object({
  body: createShortCodeBodySchema,
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const patchShortCodeSchema = z.object({
  body: z.object({
    code: z.string().optional(),
    expiryDate: z.string().optional(),
    password: z.string().optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const batchShortenSchema = z.object({
  body: z.array(createShortCodeBodySchema),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const redirectShortCodeSchema = z.object({
  body: z.any(),
  params: z.object({}).passthrough(),
  query: z.object({
    code: z.union([z.string(), z.array(z.string())]).optional(),
    password: z.union([z.string(), z.array(z.string())]).optional(),
  }).passthrough(),
});

export {
  batchShortenSchema,
  createShortCodeSchema,
  patchShortCodeSchema,
  redirectShortCodeSchema,
};
