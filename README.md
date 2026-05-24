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
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=root123
   DB_NAME=postgres
   ```

4. Create the database table:

   ```bash
   bun run create-table
   ```

5. Start the development server:

   ```bash
   bun run dev
   ```

   The server runs at `http://localhost:3000`.

## Run Tests

Make sure PostgreSQL is running.

```bash
bun test
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

# Load Testing Results Summary

## For /shorten endpoint

| Concurrency | P50      | P90      | P95      | P99      |
| ----------- | -------- | -------- | -------- | -------- |
| 50          | 247.56ms | 258.77ms | 258.81ms | 258.97ms |
| 100         | 179.06ms | 196.31ms | 198.85ms | 199.49ms |
| 200         | 283.55ms | 320.51ms | 324.29ms | 329.58ms |
| 500         | 251.72ms | 319.92ms | 331.30ms | 338.21ms |
| 1000        | 353.73ms | 499.14ms | 514.18ms | 529.91ms |
| 10K         | 0.65s    | 1.07s    | 1.12s    | 2.08s    |
| 1M          | 0.85s    | 0.98s    | 0.98s    | 4.86s    |

### chart: https://docs.google.com/spreadsheets/d/1oO-rW8SEZVuGvK_rxKl3ZFB85mJu7tFPGxL-cYiBbhE/edit?usp=sharing

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

### Redirect Using a Short Code

```bash
curl -i "http://localhost:3000/api/v1/redirect?code=generatedCode"
```

When the short code exists, the endpoint responds with an HTTP redirect to the stored original URL. Otherwise, the API returns a `404 Not Found` response.

## Optional Data Seed Script (Already created for module 1)

The repository includes a bulk insert script intended for database/performance testing. It inserts up to `100,000,000` generated URL rows, so it is not required to test the two API endpoints and can take substantial time and disk space.

```bash
bun run insert-100M
```

## Production Build

```bash
bun run build
bun run start
```
