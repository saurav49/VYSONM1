import request from 'supertest';
import app from '../app';
import { describe, it, expect } from 'bun:test';

describe('URL Shortener integration test', () => {
  it('should shorten the url and redirect correctly', async () => {
    const originalUrl = 'https://chatgpt.com/';
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
