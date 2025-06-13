// Yeets endpoints integration test
import request from 'supertest';
import { createTestApp } from '../simpleTestApp.js';

// Create application instance for testing
const app = createTestApp();

// Test suite
describe('Yeets Endpoints', () => {
  describe('GET /yeets', () => {
    it('should return a list of yeets', async () => {
      const response = await request(app)
        .get('/yeets');
      
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('content');
    });
  });

  describe('POST /yeets', () => {
    it('should create a new yeet', async () => {
      const response = await request(app)
        .post('/yeets')
        .send({
          content: 'This is a test yeet'
        });
      
      expect(response.statusCode).toBe(201); // Our simple app returns 201 on creation
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('authorId');
    });

    it('should handle yeet creation', async () => {
      const response = await request(app)
        .post('/yeets')
        .send({
          content: 'Another test yeet'
        });
      
      expect(response.statusCode).toBe(201);
      expect(response.body.content).toBe('Another test yeet');
    });
  });

  describe('GET /yeets/:id', () => {
    it('should return a specific yeet by ID', async () => {
      const response = await request(app)
        .get('/yeets/mock-yeet-id')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('content');
    });
  });
  
  describe('DELETE /yeets/:id', () => {
    it('should delete a yeet', async () => {
      const response = await request(app)
        .delete('/yeets/mock-yeet-id')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /yeets/:id/like', () => {
    it('should like a yeet', async () => {
      const response = await request(app)
        .post('/yeets/mock-yeet-id/like')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /yeets/:id/retweet', () => {
    it('should retweet a yeet', async () => {
      const response = await request(app)
        .post('/yeets/mock-yeet-id/retweet')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /yeets/timeline', () => {
    it('should return the user timeline', async () => {
      const response = await request(app)
        .get('/yeets/timeline')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
    });
  });
});