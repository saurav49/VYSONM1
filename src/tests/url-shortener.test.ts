import request from 'supertest';
import app from '../app';
import { describe, it, expect } from 'bun:test';
import { prisma } from '../lib/prisma';

const apiKey =
  '6119a8ec733a72de1361c61dbe7e456d8046c071e18e52c20004d48440495015';

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

    expect(shortenerResponse.status).toBe(400);
  });
});

// invalid original url
describe('URL Shortener invalid original url test', () => {
  it('should check if the url provided is valid', async () => {
    const originalUrl = `vyson`;
    const shortenerResponse = await request(app).post('/api/v1/shorten').send({
      originalUrl,
    });

    expect(shortenerResponse.status).toBe(400);
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

    expect(res.statusCode).toBe(400);
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
    expect(res.statusCode).toBe(400);
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
