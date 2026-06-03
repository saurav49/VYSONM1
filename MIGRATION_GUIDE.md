# Migration Guide: Authentication

This guide explains how to migrate clients to the API version that introduced API key authentication as a major change.

## Summary

Authentication is now required for user-owned URL operations. Clients must create a user, store the returned API key, and send that key in the `x-api-key` request header for protected endpoints.

This is a breaking change for clients that previously called protected endpoints without credentials.

## What Changed

### Before

Clients could create and manage short codes without sending an API key.

```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://example.com"}'
```

### After

Clients must send `x-api-key`.

```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"originalUrl":"https://example.com"}'
```

Requests without a valid API key now return `401`.

## Get an API Key

Create a user:

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"Example User"}'
```

Response:

```json
{
  "status": true,
  "data": {
    "id": 1,
    "apiKey": "YOUR_API_KEY"
  }
}
```

Store the API key securely. It is required for authenticated requests.

## Protected Endpoints

The following endpoints require `x-api-key`:

- `POST /api/v1/shorten`
- `PATCH /api/v1/shorten`
- `POST /api/v1/shorten/batch`
- `DELETE /api/v1/short-codes/{code}`
- `GET /api/v1/users/short-list`
- `DELETE /api/v1/users`

The following endpoints remain public:

- `POST /api/v1/users`
- `GET /api/v1/redirect?code={code}`
- `GET /api/v1/ping`
- `GET /api/v1/health`
- `GET /api/v1/analytics`

## Required Client Changes

1. Create a user with `POST /api/v1/users`.
2. Persist the returned `apiKey`.
3. Add this header to protected requests:

```http
x-api-key: YOUR_API_KEY
```

4. Handle authentication errors:

```json
{
  "status": false,
  "message": "X API Key missing"
}
```

or:

```json
{
  "status": false,
  "message": "Unauthorized access"
}
```

## Bulk Creation

Bulk creation also requires the user to be on the `ENTERPRISE` tier.

```bash
curl -X POST http://localhost:3000/api/v1/shorten/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: ENTERPRISE_API_KEY" \
  -d '[{"originalUrl":"https://example.com/a"},{"originalUrl":"https://example.com/b"}]'
```

Hobby-tier users receive `403`.

## Rollout Checklist

- Update clients to create or retrieve an API key before protected calls.
- Add `x-api-key` to all protected endpoint requests.
- Update tests and API clients to expect `401` for missing or invalid keys.
- Keep public redirect links unchanged; end users can still use redirect URLs without an API key.
- Store API keys outside source code, for example in environment variables or a secrets manager.
