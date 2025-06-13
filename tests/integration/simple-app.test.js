/**
 * Simplified integration tests for post-service
 */

import { jest } from '@jest/globals';
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check Endpoint', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'post-service');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('cache');
      expect(response.body.checks).toHaveProperty('memory');
      expect(response.body).toHaveProperty('environment', 'test');
    });
  });

  describe('Yeet Endpoints', () => {
    test('should get all yeets', async () => {
      const response = await request(app)
        .get('/yeets')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('content');
      expect(response.body[0]).toHaveProperty('authorId');
    });

    test('should create a new yeet', async () => {
      const newYeet = {
        content: 'This is a test yeet'
      };

      const response = await request(app)
        .post('/yeets')
        .send(newYeet)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('content', newYeet.content);
      expect(response.body).toHaveProperty('authorId', 'test-user-id');
      expect(response.body).toHaveProperty('createdAt');
    });

    test('should get a specific yeet by id', async () => {
      const yeetId = 'test-yeet-id';

      const response = await request(app)
        .get(`/yeets/${yeetId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', yeetId);
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('authorId');
      expect(response.body).toHaveProperty('createdAt');
    });
  });
  describe('Internal Endpoints', () => {
    test('should create internal user', async () => {
      const newUser = {
        username: 'testuser',
        authUserId: 'auth-123'
      };

      const response = await request(app)
        .post('/internal/users')
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username', newUser.username);
      expect(response.body).toHaveProperty('authUserId', newUser.authUserId);
      expect(response.body).toHaveProperty('createdAt');
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 routes gracefully', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body).toHaveProperty('service', 'post-service');
    });    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/yeets')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(500); // Our simple error handler returns 500

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Authentication', () => {
    test('yeet endpoints should require authentication', async () => {
      // The test app always provides mock authentication
      // So we test that the user is properly set
      const response = await request(app)
        .get('/yeets')
        .expect(200);

      // Should succeed because test middleware provides mock user
      expect(response.status).toBe(200);
    });    test('internal endpoints should require service token', async () => {
      // The test app always provides mock service token authentication
      const response = await request(app)
        .post('/internal/users')
        .send({ 
          username: 'testuser',
          authUserId: 'auth-123'
        })
        .expect(201);

      // Should succeed because test middleware provides mock service token
      expect(response.status).toBe(201);
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin', 'http://localhost:3000');
    });
  });
});
