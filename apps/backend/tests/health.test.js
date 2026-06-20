import request from 'supertest';
import { createApp } from '../src/app.js';

describe('health endpoint', () => {
  test('returns healthy API metadata', async () => {
    const app = createApp();

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        service: 'moneyhub-backend',
        version: '0.1.0'
      },
      error: null,
      meta: expect.objectContaining({
        requestId: expect.any(String)
      })
    });
  });
});
