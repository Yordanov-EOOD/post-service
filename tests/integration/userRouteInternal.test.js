// User Route Internal integration tests
import request from 'supertest';
import { createTestApp } from '../simpleTestApp.js';

// Create test app
const app = createTestApp();

// Setup mocks
const mockUserData = {
  id: 'mock-user-id',
  authUserId: 'auth-123',
  username: 'testuser',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('User Route Internal Endpoints', () => {
  describe('POST /internal/users', () => {
    it('should create a new internal user', async () => {
      const userData = {
        authUserId: 'auth-123',
        username: 'testuser'
      };

      const response = await request(app)
        .post('/internal/users')
        .send(userData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('authUserId', 'auth-123');
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    it('should return 400 when required fields are missing', async () => {
      // Missing username
      const response1 = await request(app)
        .post('/internal/users')
        .send({ authUserId: 'auth-123' });

      expect(response1.statusCode).toBe(400);
      expect(response1.body).toHaveProperty('error');

      // Missing authUserId/userId
      const response2 = await request(app)
        .post('/internal/users')
        .send({ username: 'testuser' });

      expect(response2.statusCode).toBe(400);
      expect(response2.body).toHaveProperty('error');
    });
  });
});
