import { describe, it, expect } from 'bun:test';
import request from 'supertest';
import app from '../app';
import path from 'path';
import { TASK_QUEUE } from '../utils/constants';
import { TaskQueueAction } from '../utils/enums';
import { enqueueThumbnailTask } from '../modules/users/users.service';

const apiKey =
  '6119a8ec733a72de1361c61dbe7e456d8046c071e18e52c20004d48440495015';

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

describe('User file upload', () => {
  it('should queue thumbnail generation for file upload', async () => {
    TASK_QUEUE.length = 0;

    const filePath = path.join(process.cwd(), 'src/tests/fixtures/nebo.png');
    await enqueueThumbnailTask({
      id: 1,
      filePath,
    });

    expect(TASK_QUEUE).toHaveLength(1);

    const task = TASK_QUEUE[0];
    expect(task.type).toBe(TaskQueueAction.GENERATE_THUMBNAIL);

    if (task.type !== TaskQueueAction.GENERATE_THUMBNAIL) {
      throw new Error('Expected thumbnail task');
    }

    expect(task.file).toBeTruthy();
    expect(task.imagePath).toBeTruthy();
    expect(task.id).toBeTruthy();
  });
});
