// Health endpoint integration test
import request from 'supertest';
import { createTestApp } from '../simpleTestApp.js';

describe('Health Endpoint', () => {
  const app = createTestApp();

  it('should return 200 OK for the health endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('service', 'post-service');
  });
});