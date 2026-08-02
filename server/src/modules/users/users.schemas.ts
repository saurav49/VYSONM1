import { z } from 'zod';

const createUserSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required'),
    name: z.string().min(1, 'Name is required'),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const userShortListSchema = z.object({
  body: z.any(),
  params: z.object({}).passthrough(),
  query: z
    .object({
      page: z.string().optional(),
    })
    .passthrough(),
});

const fileUploadSchema = z.object({
  file: z.object({
    filename: z.string(),
    mimetype: z.string(),
    size: z.number(),
  }),
});

export { createUserSchema, userShortListSchema, fileUploadSchema };
