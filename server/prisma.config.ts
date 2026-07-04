import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const user = process.env.DB_USER ?? 'postgres';
const password = process.env.DB_PASSWORD ?? 'root123';
const host = process.env.DB_HOST ?? 'localhost';
const port = process.env.DB_PORT ?? '5432';
const database = process.env.DB_NAME ?? 'postgres';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Client generation does not connect to the database during image builds.
    url:
      process.env.DATABASE_URL ??
      `postgresql://${user}:${password}@${host}:${port}/${database}`,
  },
});
