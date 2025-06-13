/**
 * Integration tests for post service basic functionality
 */

import request from 'supertest';
import { createTestApp } from '../simpleTestApp.js';

describe('Post Service Integration Tests', () => {
  let app;
  
  beforeAll(async () => {
    // Initialize test environment
    process.env.NODE_ENV = 'test';
    
    // Create test app instance
    app = createTestApp();
  });

  describe('Health Check Endpoint', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'post-service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('cache');
      expect(response.body.checks).toHaveProperty('memory');
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 routes gracefully', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body).toHaveProperty('service', 'post-service');
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin', 'http://localhost:3000');
    });
  });
});
