# URL Shortener API

A minimal URL shortener service built with TypeScript, Express, and PostgreSQL.

## Endpoints

The API endpoint `/api/v1`.

| Method | Endpoint                       | Description                                                 |
| ------ | ------------------------------ | ----------------------------------------------------------- |
| `POST` | `/api/v1/shorten`              | Accepts an original URL and returns a generated short code. |
| `GET`  | `/api/v1/redirect?code={code}` | Redirects to the original URL for a short code.             |
| `GET`  | `/api/v1/ping`                 | Checks whether the server is running.                       |

## Tech Stack

- TypeScript
- Express
- PostgreSQL running locally in Docker
- Bun for dependency installation and script execution

> Note: The database implementation in this repository uses PostgreSQL in Docker rather than SQLite.

## Prerequisites

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/)

## Run Locally

1. Install dependencies:

   ```bash
   bun i
   ```

2. Start PostgreSQL in Docker:

   ```bash
   docker run --name url-shortener-postgres \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=root123 \
     -e POSTGRES_DB=postgres \
     -p 5432:5432 \
     -d postgres:16
   ```

   If the container has already been created and is stopped, start it with:

   ```bash
   docker start url-shortener-postgres
   ```

3. Create a `.env` file in the repository root
   OR you can also do `cp .env.example .env`
   :

   ```env
   PORT=3000
   DATABASE_URL='postgresql://postgres:root123@localhost:5432/postgres'
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=root123
   DB_NAME=postgres
   ```

4. Apply local database migrations:

   ```bash
   bunx --bun prisma migrate dev
   ```

5. Start the development server:

   ```bash
   bun run dev
   ```

   The server runs at `http://localhost:3000`.

## Database Migrations

This project uses Prisma migrations. The migration files live in `prisma/migrations` and should be committed to git.

### Create a Migration Locally

1. Update the Prisma schema in `prisma/schema.prisma`.

2. Create and apply a migration against your local database:

   ```bash
   bunx --bun prisma migrate dev --name your_migration_name
   ```

   Example:

   ```bash
   bunx --bun prisma migrate dev --name add_last_accessed_at
   ```

3. Check the migration status:

   ```bash
   bunx --bun prisma migrate status
   ```

4. Commit both the schema change and the generated migration folder:

   ```bash
   git add prisma/schema.prisma prisma/migrations
   git commit -m "Add database migration"
   ```

Use `migrate dev` only for local development. It can create new migration files and may prompt for development-only actions.

### Apply Existing Migrations Locally

If the migration files already exist and you only need to bring your local database up to date:

```bash
bunx --bun prisma migrate dev
```

### Deploy Migrations to QA

Set `DATABASE_URL` to the QA PostgreSQL connection string, then deploy the committed migrations:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE' bunx --bun prisma migrate deploy
```

Verify QA after deployment:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE' bunx --bun prisma migrate status
```

### Deploy Migrations to Production

Deploy only migration files that have already been tested locally and in QA.

Set `DATABASE_URL` to the production PostgreSQL connection string, then run:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE' bunx --bun prisma migrate deploy
```

Verify production after deployment:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE' bunx --bun prisma migrate status
```

Do not use `prisma migrate dev` in QA or production. Use `prisma migrate deploy` for shared environments because it only applies committed migrations and does not create new ones.

## Run Tests

Make sure PostgreSQL is running and local migrations have been applied.

The integration tests verify:

- A created short URL redirects to its original URL
- A duplicate URL returns the same short code
- An unknown short code returns `404`
- A short code can be deleted
- A missing original URL returns `400`
- An invalid original URL returns `400`
- A missing redirect code returns `400`

```bash
bun test src/tests/url-shortener.test.ts
```

## API Usage

### Shorten a URL

```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://example.com/some/long/path"}'
```

Example response:

```json
{
  "status": true,
  "data": {
    "originalUrl": "https://example.com/some/long/path",
    "shortCode": "generatedCode"
  }
}
```

### Redirect Using a Short Code

```bash
curl -i "http://localhost:3000/api/v1/redirect?code=generatedCode"
```

When the short code exists, the endpoint responds with an HTTP redirect to the stored original URL. Otherwise, the API returns a `404 Not Found` response.

# Load Testing

## For /shorten endpoint

```
oha -m POST -n 10 -c 10 \
  -H "Content-Type: application/json" \
  -d '{"originalUrl": "https://terminaltrove.com/oha/"}' \
  http://localhost:3000/api/v1/shorten
```

Results:

| Percentile | Latency   |
| ---------- | --------- |
| P50        | 165.55 ms |
| P90        | 168.32 ms |
| P95        | 168.32 ms |
| P99        | 168.32 ms |

Some findings:

1. On an average, the request take 165.58ms
2. Each request size: 98B, total data (accross all request): 960B
3. DNS+dialup took on average 4.7ms
4. DNS lookup took on average 0.88ms (since localhost so much faster)

## For /redirect endpoint

```
oha --redirect 0 -n 10 -c 10 \
  "http://localhost:3000/api/v1/redirect?code=vmHkU6cyx0"
```

Results:

| Percentile | Latency   |
| ---------- | --------- |
| P50        | 134.13 ms |
| P90        | 137.16 ms |
| P95        | 137.16 ms |
| P99        | 137.14 ms |

Some findings:

1. On an average, the request take 134.01ms
2. Each request size: 42 B, total data (accross all request): 420 b
3. DNS+dialup took on average 3.9ms
4. DNS lookup took on average 1.08ms (since localhost so much faster)

# Load Testing Results Summary

## For /shorten endpoint

| Concurrency | Success |     Avg |   p50 |   p90 |   p95 |   p99 |
| ----------: | ------: | ------: | ----: | ----: | ----: | ----: |
|          50 |    100% |   247ms | 247ms | 258ms | 258ms | 258ms |
|         100 |    100% |   176ms | 179ms | 196ms | 198ms | 199ms |
|         200 |    100% |   270ms | 283ms | 320ms | 324ms | 329ms |
|         500 |    100% |   248ms | 251ms | 319ms | 331ms | 337ms |
|        1000 |    100% |   356ms | 353ms | 499ms | 514ms | 528ms |
|      10,000 |     25% | invalid | 658ms | 1.07s | 1.12s | 2.08s |
|   1,000,000 |    2.2% | invalid | 858ms | 963ms | 983ms | 2.95s |

### chart: https://docs.google.com/spreadsheets/d/1oO-rW8SEZVuGvK_rxKl3ZFB85mJu7tFPGxL-cYiBbhE/edit?usp=sharing

## For /redirect endpoint

| Concurrency | Success Rate |     Avg |   p50 |   p90 |   p95 |   p99 |
| ----------- | -----------: | ------: | ----: | ----: | ----: | ----: |
| 50          |         100% |   186ms | 187ms | 191ms | 191ms | 192ms |
| 100         |         100% |   130ms | 132ms | 139ms | 139ms | 142ms |
| 200         |         100% |   130ms | 131ms | 142ms | 143ms | 144ms |
| 500         |         100% |   174ms | 174ms | 208ms | 212ms | 215ms |
| 1000        |         100% |   298ms | 306ms | 371ms | 383ms | 389ms |
| 10,000      |          25% | invalid | 532ms | 688ms | 700ms | 1.09s |
| 1,000,000   |           3% | invalid | 710ms | 898ms | 925ms | 1.89s |

### chart: https://docs.google.com/spreadsheets/d/1GM1eyY_tmzvEwq5OaCbHrcVj8p6MmXgw7Cq-HePnpQQ/edit?usp=sharing

## Deployed

## For /shorten endpoint

| Concurrency | Success Rate |      Avg |      P50 |      P90 |      P99 |
| ----------: | -----------: | -------: | -------: | -------: | -------: |
|          10 |         100% | 1.28 sec | 1.25 sec | 1.91 sec | 1.91 sec |
|         100 |         100% | 1.05 sec | 1.02 sec | 1.12 sec | 1.60 sec |
|         500 |         100% | 1.38 sec | 1.39 sec | 1.59 sec | 1.92 sec |
|        1000 |         100% | 2.10 sec | 1.85 sec | 3.14 sec | 3.38 sec |
|       10000 |          20% | 4.03 sec | 4.00 sec | 5.62 sec | 9.88 sec |

## For /redirect endpoint

| Concurrency | Success Rate |   Avg |   p50 |   p90 |   p95 |   p99 |
| ----------- | -----------: | ----: | ----: | ----: | ----: | ----: |
| 10          |         100% | 791ms | 785ms | 820ms | 820ms | 820ms |
| 100         |         100% | 846ms | 842ms | 901ms | 906ms | 934ms |
| 200         |         100% | 0.87s | 0.87s | 0.96s |    1s |    1s |
| 500         |         100% | 1.17s |  1.1s |  1.3s |  1.3s |  1.3s |
| 1000        |         100% | 2.09s |  1.6s |  3.1s |  3.2s |  3.4s |
| 10,000      |          20% |  3.6s |    4s |  5.2s |  5.3s |  8.2s |

For deployed, it generally slower then the local, due to it taking more time for DNS lookup, TCP handshake

## Production Build

```bash
bun run build
bun run start
```
