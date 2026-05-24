import request from 'supertest';
import app from '../app';
import { describe, it, expect } from 'bun:test';

describe('URL Shortener integration test', () => {
  it('should shorten the url and redirect correctly', async () => {
    const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
    const shortenerResponse = await request(app).post('/api/v1/shorten').send({
      originalUrl,
    });

    expect(shortenerResponse.status).toBe(201);
    const shortCode = shortenerResponse.body.data.shortCode;
    expect(shortCode).toBeDefined();

    const urlRedirectResponse = await request(app)
      .get(`/api/v1/redirect?code=${shortCode}`)
      .redirects(0);

    expect(urlRedirectResponse.status).toBe(302);
    expect(urlRedirectResponse.headers.location).toBe(originalUrl);
  });
});

// [Q7] What happens if the same URL is sent again? Handle this case of duplicate URLs. Write a test case that generates a random URL and sends it twice to the API. The same short code should be returned.

describe('URL Shortener duplicate test', () => {
  it('should handle same url and return the same code correctly', async () => {
    const originalUrl = `https://chatgpt.com/${new Date().getTime()}`;
    const shortenerResponse1 = await request(app).post('/api/v1/shorten').send({
      originalUrl,
    });
    const shortenerResponse2 = await request(app).post('/api/v1/shorten').send({
      originalUrl,
    });

    expect(shortenerResponse1.status).toBe(201);
    expect(shortenerResponse2.status).toBe(200);

    const shortCode1 = shortenerResponse1.body.data.shortCode;
    const shortCode2 = shortenerResponse2.body.data.shortCode;

    expect(shortCode1).toBeDefined();
    expect(shortCode2).toBeDefined();

    expect(shortCode1).toBe(shortCode2);
  });
});
