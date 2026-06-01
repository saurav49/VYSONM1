import { describe, it, expect } from 'bun:test';
import request from 'supertest';
import app from '../app';

// user create
describe('Users creation test', () => {
  it('should create user and return 201 status code', async () => {
    const email = `billy-${Date.now()}@gmail.com`;
    const name = 'Billy';
    const response = await request(app).post('/api/v1/users').send({
      email,
      name,
    });
    expect(response.statusCode).toBe(201);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.apiKey).toBeDefined();

    const deleteUser = await request(app)
      .delete('/api/v1/users')
      .set('x-api-key', response.body.data.apiKey);
    expect(deleteUser.statusCode).toBe(200);
  });
});

// missing email/name
describe('User creation validation', () => {
  it('should return 401 when name is missing', async () => {
    const res = await request(app).post('/api/v1/users').send({
      email: 'mox@gmail.com',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      status: false,
      message: 'Email and name are required',
    });
  });
  it('should return 401 when email is missing', async () => {
    const response = await request(app).post('/api/v1/users').send({
      name: 'Jon Moxley',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      status: false,
      message: 'Email and name are required',
    });
  });
  it('should return 401 when email is invalid', async () => {
    const response = await request(app).post('/api/v1/users').send({
      name: 'Jon Moxley',
      email: 'mox.com',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      status: false,
      message: 'Invalid email',
    });
  });
});
