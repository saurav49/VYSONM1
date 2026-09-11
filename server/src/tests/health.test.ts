import { beforeAll, describe, it, expect } from 'bun:test';
import request from 'supertest';
let app: any;
if (process.env.RUN_INTEGRATION_TESTS === 'true') {
  beforeAll(async () => {
    app = (await import('../app.js')).default;
  });
}
const integrationDescribe =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

integrationDescribe('Ping checkpoint test', () => {
  it('should check the ping checkpoint and return success status', async () => {
    const response = await request(app).get('/api/v1/ping');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: true,
      message: 'Server up and running',
    });
  });
});

integrationDescribe('Health checkpoint test', () => {
  it('should check the health checkpoint and return success status', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toEqual(true);
    expect(response.body.database).toEqual('CONNECTED');
  });
});
