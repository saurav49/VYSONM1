import { describe, expect, it } from 'bun:test';
import { ZodError, z } from 'zod';
import { redis } from '../config/redis';
import { prisma } from '../db/prisma';
import { getAnalytics } from '../modules/analytics/analytics.service';
import { AppError } from '../shared/errors/AppError';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from '../shared/errors/httpErrors';
import { errorResponse, successResponse } from '../shared/responses/apiResponse';
import { validateRequest } from '../shared/validation/validateRequest';
import {
  deleteCache,
  getCache,
  hasFeature,
  isValidDateTime,
  isValidEmail,
  retryLogic,
  sendSse,
  setCache,
  setCacheFIFO,
  sleep,
} from '../utils/util';

const request = (body: unknown = {}) =>
  ({ body, params: {}, query: {}, file: undefined } as any);

const response = () => {
  const result: any = { statusCode: 0, body: undefined, headers: {}, writes: [] };
  result.status = (statusCode: number) => {
    result.statusCode = statusCode;
    return result;
  };
  result.json = (body: unknown) => {
    result.body = body;
    return result;
  };
  result.write = (value: string) => result.writes.push(value);
  return result;
};

describe('utility helpers', () => {
  it('validates emails and ISO-compatible dates', () => {
    expect(isValidEmail('person@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidDateTime('2026-01-01T00:00:00.000Z')).toBe(true);
    expect(isValidDateTime('not-a-date')).toBe(false);
  });

  it('uses a stable feature flag bucket', () => {
    expect(hasFeature('user-1')).toBe(hasFeature('user-1'));
    expect(typeof hasFeature('user-2')).toBe('boolean');
  });

  it('retries a failing operation and returns its later result', async () => {
    let attempts = 0;
    const result = await retryLogic({
      fn: async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('temporary');
        return 'done';
      },
      retires: 2,
      delay: 0,
    });
    expect(result).toBe('done');
    expect(attempts).toBe(2);
  });

  it('throws the final retry error', async () => {
    await expect(
      retryLogic({ fn: async () => Promise.reject(new Error('failed')), retires: 1, delay: 0 }),
    ).rejects.toThrow('failed');
  });

  it('wraps the Redis cache operations with the expected keys', async () => {
    const calls: unknown[][] = [];
    const fakeRedis = redis as any;
    fakeRedis.del = async (...args: unknown[]) => calls.push(['del', ...args]);
    fakeRedis.set = async (...args: unknown[]) => calls.push(['set', ...args]);
    fakeRedis.get = async (...args: unknown[]) => {
      calls.push(['get', ...args]);
      return 'https://example.com';
    };
    fakeRedis.exists = async () => 0;
    fakeRedis.rpush = async (...args: unknown[]) => calls.push(['rpush', ...args]);
    fakeRedis.llen = async () => 1;

    await setCache({ code: 'abc', originalUrl: 'https://example.com' });
    expect(await getCache('abc')).toBe('https://example.com');
    await deleteCache('abc');
    await setCacheFIFO({ code: 'fifo', originalUrl: 'https://example.com' });
    expect(calls).toContainEqual(['set', 'shortCode:abc', 'https://example.com', 'EX', 3600]);
    expect(calls).toContainEqual(['get', 'shortCode:abc']);
    expect(calls).toContainEqual(['del', 'shortCode:abc']);
    expect(calls).toContainEqual(['rpush', 'cache:fifo:shortCodes', 'shortCode:fifo']);
  });

  it('formats SSE messages and supports short sleeps', async () => {
    const res = response();
    sendSse(res, 'update', { id: 1 });
    await sleep(0);
    expect(res.writes).toEqual(['event: update\n', 'data: {"id":1}\n\n']);
  });
});

describe('response and error helpers', () => {
  it('creates consistent response and HTTP error shapes', () => {
    expect(successResponse({ id: 1 }, 'created')).toEqual({ status: true, message: 'created', data: { id: 1 } });
    expect(errorResponse('bad')).toEqual({ status: false, message: 'bad' });
    expect(badRequest('bad')).toBeInstanceOf(AppError);
    expect(unauthorized('no').statusCode).toBe(401);
    expect(forbidden('no').statusCode).toBe(403);
    expect(notFound('no').statusCode).toBe(404);
    expect(conflict('no').statusCode).toBe(409);
  });
});

describe('analytics service', () => {
  it('returns each analytics collection from Prisma', async () => {
    const calls: unknown[] = [];
    const urlShortener = (prisma as any).urlShortener;
    urlShortener.findMany = async (args: unknown) => {
      calls.push(args);
      return calls.length === 1 ? [{ shortCode: 'latest' }] : [{ shortCode: 'popular' }];
    };
    urlShortener.groupBy = async (args: unknown) => {
      calls.push(args);
      return [{ originalUrl: 'https://example.com', _count: { originalUrl: 2 } }];
    };

    await expect(getAnalytics() as Promise<any>).resolves.toEqual({
      tenLatestUrlShortened: [{ shortCode: 'latest' }],
      tenMostPopularUrl: [{ shortCode: 'popular' }],
      tenMostShortenUrl: [{ originalUrl: 'https://example.com', _count: { originalUrl: 2 } }],
    });
    expect(calls).toHaveLength(3);
  });
});

describe('request validation middleware', () => {
  it('applies safe-parse data and reports safe-parse failures', () => {
    const req = request({ name: 'before' });
    let nextError: unknown;
    validateRequest({ safeParse: () => ({ success: true, data: { body: { name: 'after' }, params: { id: '1' } } }) })(req, response(), (error?: unknown) => { nextError = error; });
    expect(req.body).toEqual({ name: 'after' });
    expect(req.params).toEqual({ id: '1' });
    expect(nextError).toBeUndefined();

    validateRequest({ safeParse: () => ({ success: false, error: new Error('invalid input') }) })(request(), response(), (error?: unknown) => { nextError = error; });
    expect(nextError).toBeInstanceOf(AppError);
    expect((nextError as AppError).message).toBe('invalid input');
  });

  it('supports parse, validate, invalid schemas, and Zod errors', () => {
    let nextError: unknown;
    const parsed = request();
    validateRequest({ parse: () => ({ body: { parsed: true } }) })(parsed, response(), (error?: unknown) => { nextError = error; });
    expect(parsed.body).toEqual({ parsed: true });
    expect(nextError).toBeUndefined();

    validateRequest({ validate: () => ({ error: { message: 'invalid' } }) })(request(), response(), (error?: unknown) => { nextError = error; });
    expect((nextError as AppError).message).toBe('invalid');
    validateRequest({})(request(), response(), (error?: unknown) => { nextError = error; });
    expect((nextError as AppError).message).toBe('Invalid validation schema');

    const zodError = new ZodError([{ code: 'custom', path: ['email'], message: 'required' }]);
    validateRequest({ parse: () => { throw zodError; } })(request(), response(), (error?: unknown) => { nextError = error; });
    expect((nextError as AppError).message).toBe('email: required');
  });
});
