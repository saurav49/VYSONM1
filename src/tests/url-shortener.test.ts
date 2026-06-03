import request from 'supertest';
import app, { memCache } from '../app';
import { describe, it, expect } from 'bun:test';
import { prisma } from '../lib/prisma';
import { Tier } from '../utils/enums';

const apiKey =
  '6119a8ec733a72de1361c61dbe7e456d8046c071e18e52c20004d48440495015';
const integrationTimeout = 15000;

const uniqueCode = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createUser = async (tier: Tier = Tier.HOBBY) => {
  const email = `${uniqueCode('user')}@example.com`;
  const res = await request(app).post('/api/v1/users').send({
    email,
    name: 'Test User',
  });
  expect(res.statusCode).toBe(201);
  const { id, apiKey } = res.body.data;
  if (tier !== Tier.HOBBY) {
    await prisma.user.update({
      where: { id },
      data: { tier },
    });
  }
  return { id, apiKey };
};

const createShortCode = async ({
  apiKey,
  originalUrl = `https://example.com/${uniqueCode('url')}`,
  code = uniqueCode('code'),
  expiryDate,
  password,
}: {
  apiKey: string;
  originalUrl?: string;
  code?: string;
  expiryDate?: string;
  password?: string;
}) => {
  const res = await request(app)
    .post('/api/v1/shorten')
    .set('x-api-key', apiKey)
    .send({
      originalUrl,
      code,
      expiryDate,
      password,
    });
  expect(res.statusCode).toBe(201);
  return { res, shortCode: res.body.data.shortCode, originalUrl };
};

describe('URL Shortener integration test', () => {
  it('should shorten the url and redirect correctly', async () => {
    const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
    const shortenerResponse = await request(app)
      .post('/api/v1/shorten')
      .send({
        originalUrl,
      })
      .set('x-api-key', apiKey);

    expect(shortenerResponse.status).toBe(201);
    const shortCode = shortenerResponse.body.data.shortCode;
    expect(shortCode).toBeDefined();

    const urlRedirectResponse = await request(app)
      .get(`/api/v1/redirect?code=${shortCode}`)
      .redirects(0);

    expect(urlRedirectResponse.status).toBe(302);
    expect(urlRedirectResponse.headers.location).toBe(originalUrl);

    const deleteResponse = await request(app)
      .delete(`/api/v1/short-codes/${shortCode}`)
      .set('x-api-key', apiKey);
    expect(deleteResponse.status).toBe(200);
  });
  it('should return 409 for duplicate short code', async () => {
    const shortCode = 'JfU2UG8-oB';
    const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
    const res = await request(app)
      .post('/api/v1/shorten')
      .send({
        originalUrl,
        code: shortCode,
      })
      .set('x-api-key', apiKey);

    expect(res.statusCode).toBe(409);
  });
  it('should return 201 for custom short code', async () => {
    const shortCode = `abc-${Date.now()}`;
    const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
    const res = await request(app)
      .post('/api/v1/shorten')
      .send({
        code: shortCode,
        originalUrl,
      })
      .set('x-api-key', apiKey);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.shortCode).toBe(shortCode);

    const deleteRes = await request(app)
      .delete(`/api/v1/short-codes/${res.body.data.shortCode}`)
      .set('x-api-key', apiKey);
    expect(deleteRes.status).toBe(200);
  });
  it('should return 403 for non enterprise batch insert', async () => {
    const shortCode = `abc-${Date.now()}`;
    const shortCode2 = `abd-${Date.now()}`;
    const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
    const res = await request(app)
      .post('/api/v1/shorten/batch')
      .send([
        {
          code: shortCode,
          originalUrl,
        },
        {
          code: shortCode2,
          originalUrl,
        },
      ])
      .set('x-api-key', apiKey);
    expect(res.statusCode).toBe(403);
  });
});

describe('Cache URL Redirect', () => {
  it(
    'should use cache',
    async () => {
      const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
      const r = await request(app)
        .post('/api/v1/shorten')
        .send({
          originalUrl,
        })
        .set('x-api-key', apiKey);

      expect(r.statusCode).toBe(201);
      const code = r.body.data.shortCode;
      const redirectResponse1 = await request(app).get(
        `/api/v1/redirect?code=${code}`,
      );
      const redirectResponse2 = await request(app).get(
        `/api/v1/redirect?code=${code}`,
      );

      expect(redirectResponse1.statusCode).toBe(302);
      expect(redirectResponse2.statusCode).toBe(302);
      expect(memCache[code]).toBe(originalUrl);

      const deleteResponse = await request(app)
        .delete(`/api/v1/short-codes/${code}`)
        .set('x-api-key', apiKey);
      expect(deleteResponse.statusCode).toBe(200);
    },
    integrationTimeout,
  );
});

// [Q8] What happens when you try to fetch a short code that doesn’t exist? Find out which http status code would suit best here. Add this as a test as well.
describe('URL Shortener invalid code test', () => {
  it('should handle the invalid short code', async () => {
    const code = 'abc';
    const redirectUrl = await request(app)
      .get(`/api/v1/redirect?code=${code}`)
      .redirects(0);

    expect(redirectUrl.status).toBe(404);
  });
});

// delete short code
describe('URL Shortener delete short code', () => {
  it('should handle the deletion of short code', async () => {
    const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({
        originalUrl,
      })
      .set('x-api-key', apiKey);

    expect(response.status).toBe(201);
    const shortCode = response.body.data.shortCode;
    expect(shortCode).toBeDefined();

    const deleteResponse = await request(app)
      .delete(`/api/v1/short-codes/${shortCode}`)
      .set('x-api-key', apiKey);

    expect(deleteResponse.status).toBe(200);
  });
});

// missing original url
describe('URL Shortener missing original url test', () => {
  it('should check if the url provided is correct', async () => {
    const originalUrl = ``;
    const shortenerResponse = await request(app).post('/api/v1/shorten').send({
      originalUrl,
    });

    expect(shortenerResponse.status).toBe(401);
  });
});

// invalid original url
describe('URL Shortener invalid original url test', () => {
  it('should check if the url provided is valid', async () => {
    const originalUrl = `vyson`;
    const shortenerResponse = await request(app).post('/api/v1/shorten').send({
      originalUrl,
    });

    expect(shortenerResponse.status).toBe(401);
  });
});

// code not passed in redirect url
describe('URL Shortener code not passed', () => {
  it('should pass the code in redirect url', async () => {
    const code = ``;
    const res = await request(app).get(`/api/v1/redirect?code=${code}`);

    expect(res.status).toBe(400);
  });
});

// missing/invalid x-api-key
describe('Url Shortener x-api-key validation', () => {
  it('should return 401 for invalid x-api-key', async () => {
    const res = await request(app)
      .post('/api/v1/shorten')
      .set('x-api-key', 'invalid api key')
      .send({
        originalUrl: 'https://google.com',
      });

    expect(res.statusCode).toBe(401);
  });
  it('should return 401 for missing x-api-key', async () => {
    const res = await request(app).post('/api/v1/shorten').send({
      originalUrl: 'https://google.com',
    });
    expect(res.statusCode).toBe(401);
  });
});

// expiry date
describe('Url Shortener Expiry date', () => {
  it('should return 400 for invalid expiry date', async () => {
    const res = await request(app).post('/api/v1/shorten').send({
      originalUrl: 'https://google.com',
      expiryDate: '123',
    });

    expect(res.statusCode).toBe(401);
  });
  it('should return 201 for valid expiry date', async () => {
    const res = await request(app)
      .post('/api/v1/shorten')
      .send({
        originalUrl: 'https://google.com',
        expiryDate: '07-06-2026', // month-day-year
      })
      .set('x-api-key', apiKey);
    expect(res.statusCode).toBe(201);
    const deleteRes = await request(app)
      .delete(`/api/v1/short-codes/${res.body.data.shortCode}`)
      .set('x-api-key', apiKey);
    expect(deleteRes.statusCode).toBe(200);
  });
  it('should return 400 for past expiry date', async () => {
    const res = await request(app).post('/api/v1/shorten').send({
      originalUrl: 'https://google.com',
      expiryDate: '02-06-2026', // month-day-year
    });
    expect(res.statusCode).toBe(401);
  });
  it('should return 404 when redirecting an expired url', async () => {
    const originalUrl = `https://google.com/${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/shorten')
      .send({
        originalUrl,
        expiryDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .set('x-api-key', apiKey);

    expect(createRes.statusCode).toBe(201);

    const shortCode = createRes.body.data.shortCode;

    await prisma.urlShortener.update({
      where: {
        shortCode,
      },
      data: {
        expiryDate: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    const redirectRes = await request(app)
      .get(`/api/v1/redirect?code=${shortCode}`)
      .redirects(0);

    expect(redirectRes.statusCode).toBe(404);
    expect(redirectRes.body).toEqual({
      status: false,
      message: 'URL expired',
    });

    await prisma.urlShortener.delete({
      where: {
        shortCode,
      },
    });
  });
});

describe('URL Shortener additional coverage', () => {
  it('should allow multiple short codes for the same original URL', async () => {
    const user = await createUser();
    const originalUrl = `https://example.com/shared-${Date.now()}`;

    const first = await createShortCode({ apiKey: user.apiKey, originalUrl });
    const second = await createShortCode({ apiKey: user.apiKey, originalUrl });

    expect(first.shortCode).toBeDefined();
    expect(second.shortCode).toBeDefined();
    expect(first.shortCode).not.toBe(second.shortCode);
  });

  it(
    'should allow the owner to delete and reject another user',
    async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const { shortCode } = await createShortCode({ apiKey: owner.apiKey });

      const forbiddenRes = await request(app)
        .delete(`/api/v1/short-codes/${shortCode}`)
        .set('x-api-key', otherUser.apiKey);
      expect(forbiddenRes.statusCode).toBe(403);

      const ownerRes = await request(app)
        .delete(`/api/v1/short-codes/${shortCode}`)
        .set('x-api-key', owner.apiKey);
      expect(ownerRes.statusCode).toBe(200);
    },
    integrationTimeout,
  );

  it(
    'should not redirect a deleted short code',
    async () => {
      const owner = await createUser();
      const { shortCode } = await createShortCode({ apiKey: owner.apiKey });

      const deleteRes = await request(app)
        .delete(`/api/v1/short-codes/${shortCode}`)
        .set('x-api-key', owner.apiKey);
      expect(deleteRes.statusCode).toBe(200);

      const redirectRes = await request(app)
        .get(`/api/v1/redirect?code=${shortCode}`)
        .redirects(0);
      expect(redirectRes.statusCode).toBe(404);
    },
    integrationTimeout,
  );
});

describe('URL Shortener batch creation', () => {
  it('should allow enterprise users to batch create short codes', async () => {
    const user = await createUser(Tier.ENTERPRISE);
    const res = await request(app)
      .post('/api/v1/shorten/batch')
      .set('x-api-key', user.apiKey)
      .send([
        {
          originalUrl: `https://example.com/${uniqueCode('batch')}`,
          code: uniqueCode('batch'),
        },
        {
          originalUrl: `https://example.com/${uniqueCode('batch')}`,
          code: uniqueCode('batch'),
        },
      ]);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((r: any) => r.statusCode === 201)).toBe(true);
  });

  it('should reject hobby users with 403', async () => {
    const user = await createUser(Tier.HOBBY);
    const res = await request(app)
      .post('/api/v1/shorten/batch')
      .set('x-api-key', user.apiKey)
      .send([
        {
          originalUrl: `https://example.com/${uniqueCode('batch')}`,
          code: uniqueCode('batch'),
        },
      ]);

    expect(res.statusCode).toBe(403);
  });

  it('should return 207 for an invalid mixed batch', async () => {
    const user = await createUser(Tier.ENTERPRISE);
    const res = await request(app)
      .post('/api/v1/shorten/batch')
      .set('x-api-key', user.apiKey)
      .send([
        {
          originalUrl: `https://example.com/${uniqueCode('batch')}`,
          code: uniqueCode('batch'),
        },
        {
          originalUrl: 'not-a-url',
          code: uniqueCode('batch'),
        },
      ]);

    expect(res.statusCode).toBe(207);
    expect(res.body.status).toBe(false);
  });

  it('should return 400 for an empty batch', async () => {
    const user = await createUser(Tier.ENTERPRISE);
    const res = await request(app)
      .post('/api/v1/shorten/batch')
      .set('x-api-key', user.apiKey)
      .send([]);

    expect(res.statusCode).toBe(401);
  });

  it('should return item-level 409 for a duplicate custom code', async () => {
    const user = await createUser(Tier.ENTERPRISE);
    const duplicateCode = uniqueCode('duplicate');
    await createShortCode({ apiKey: user.apiKey, code: duplicateCode });

    const res = await request(app)
      .post('/api/v1/shorten/batch')
      .set('x-api-key', user.apiKey)
      .send([
        {
          originalUrl: `https://example.com/${uniqueCode('batch')}`,
          code: uniqueCode('batch'),
        },
        {
          originalUrl: `https://example.com/${uniqueCode('batch')}`,
          code: duplicateCode,
        },
      ]);

    expect(res.statusCode).toBe(207);
    expect(res.body.data.map((r: any) => r.statusCode)).toEqual([201, 409]);
  });
});

describe('PATCH /shorten', () => {
  it('should allow the owner to edit expiry date', async () => {
    const user = await createUser();
    const { shortCode } = await createShortCode({ apiKey: user.apiKey });
    const expiryDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .patch('/api/v1/shorten')
      .set('x-api-key', user.apiKey)
      .send({ code: shortCode, expiryDate });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.count).toBe(1);

    const updated = await prisma.urlShortener.findUnique({
      where: { shortCode },
    });
    expect(updated?.expiryDate?.toISOString()).toBe(expiryDate);
  });

  it(
    'should allow the owner to edit password',
    async () => {
      const user = await createUser();
      const { shortCode, originalUrl } = await createShortCode({
        apiKey: user.apiKey,
      });

      const patchRes = await request(app)
        .patch('/api/v1/shorten')
        .set('x-api-key', user.apiKey)
        .send({
          code: shortCode,
          expiryDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          password: 'new-secret',
        });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.body.data.count).toBe(1);

      const redirectRes = await request(app)
        .get(`/api/v1/redirect?code=${shortCode}&password=new-secret`)
        .redirects(0);
      expect(redirectRes.statusCode).toBe(302);
      expect(redirectRes.headers.location).toBe(originalUrl);
    },
    integrationTimeout,
  );

  it('should reject non-owner edits', async () => {
    const owner = await createUser();
    const otherUser = await createUser();
    const { shortCode } = await createShortCode({ apiKey: owner.apiKey });

    const res = await request(app)
      .patch('/api/v1/shorten')
      .set('x-api-key', otherUser.apiKey)
      .send({
        code: shortCode,
        expiryDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    expect(res.statusCode).toBe(403);
  });

  it('should return 404 after an owner edits a URL to be expired', async () => {
    const user = await createUser();
    const { shortCode } = await createShortCode({ apiKey: user.apiKey });

    await prisma.urlShortener.update({
      where: { shortCode },
      data: { expiryDate: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const redirectRes = await request(app)
      .get(`/api/v1/redirect?code=${shortCode}`)
      .redirects(0);
    expect(redirectRes.statusCode).toBe(404);
    expect(redirectRes.body.message).toBe('URL expired');
  });
});

describe('URL Shortener password protection', () => {
  it('should return 401 without a password for a protected URL', async () => {
    const user = await createUser();
    const { shortCode } = await createShortCode({
      apiKey: user.apiKey,
      password: 'secret',
    });

    const res = await request(app)
      .get(`/api/v1/redirect?code=${shortCode}`)
      .redirects(0);

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 for the wrong password', async () => {
    const user = await createUser();
    const { shortCode } = await createShortCode({
      apiKey: user.apiKey,
      password: 'secret',
    });

    const res = await request(app)
      .get(`/api/v1/redirect?code=${shortCode}&password=wrong`)
      .redirects(0);

    expect(res.statusCode).toBe(401);
  });

  it('should redirect with the correct password', async () => {
    const user = await createUser();
    const { shortCode, originalUrl } = await createShortCode({
      apiKey: user.apiKey,
      password: 'secret',
    });

    const res = await request(app)
      .get(`/api/v1/redirect?code=${shortCode}&password=secret`)
      .redirects(0);

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(originalUrl);
  });
});

describe('/users/short-list', () => {
  it("should return the current user's URLs", async () => {
    const user = await createUser();
    const first = await createShortCode({ apiKey: user.apiKey });
    const second = await createShortCode({ apiKey: user.apiKey });

    const res = await request(app)
      .get('/api/v1/users/short-list')
      .set('x-api-key', user.apiKey);

    expect(res.statusCode).toBe(200);
    const shortCodes = res.body.data.shortens.map((r: any) => r.shortCode);
    expect(shortCodes).toContain(first.shortCode);
    expect(shortCodes).toContain(second.shortCode);
  });

  it("should not return another user's URLs", async () => {
    const user = await createUser();
    const otherUser = await createUser();
    const otherShort = await createShortCode({ apiKey: otherUser.apiKey });
    const ownShort = await createShortCode({ apiKey: user.apiKey });

    const res = await request(app)
      .get('/api/v1/users/short-list')
      .set('x-api-key', user.apiKey);

    expect(res.statusCode).toBe(200);
    const shortCodes = res.body.data.shortens.map((r: any) => r.shortCode);
    expect(shortCodes).toContain(ownShort.shortCode);
    expect(shortCodes).not.toContain(otherShort.shortCode);
  });

  it('should handle missing or invalid API keys', async () => {
    const missingRes = await request(app).get('/api/v1/users/short-list');
    expect(missingRes.statusCode).toBe(401);

    const invalidRes = await request(app)
      .get('/api/v1/users/short-list')
      .set('x-api-key', 'invalid-api-key');
    expect(invalidRes.statusCode).toBe(401);
  });
});

describe('/analytics', () => {
  it(
    'should return analytics collections for shortened URLs',
    async () => {
      const user = await createUser();
      const originalUrl = `https://example.com/analytics-${Date.now()}`;
      const first = await createShortCode({ apiKey: user.apiKey, originalUrl });
      await createShortCode({ apiKey: user.apiKey, originalUrl });

      await request(app)
        .get(`/api/v1/redirect?code=${first.shortCode}`)
        .redirects(0);

      const res = await request(app).get('/api/v1/analytics');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data.tenLatestUrlShortened)).toBe(true);
      expect(Array.isArray(res.body.data.tenMostPopularUrl)).toBe(true);
      expect(Array.isArray(res.body.data.tenMostShortenUrl)).toBe(true);
    },
    integrationTimeout,
  );
});
