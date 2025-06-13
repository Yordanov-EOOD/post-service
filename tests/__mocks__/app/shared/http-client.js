/**
 * Mock for shared HTTP client used in Docker container environment
 */
import { jest } from '@jest/globals';

export const createUserHttpClient = jest.fn(() => ({
  get: jest.fn().mockResolvedValue({ data: { id: 'mock-user', username: 'mockuser' } }),
  post: jest.fn().mockResolvedValue({ data: { success: true } }),
  put: jest.fn().mockResolvedValue({ data: { success: true } }),
  delete: jest.fn().mockResolvedValue({ data: { success: true } })
}));

export const createAuthHttpClient = jest.fn(() => ({
  get: jest.fn().mockResolvedValue({ data: { valid: true } }),
  post: jest.fn().mockResolvedValue({ data: { token: 'mock-token' } }),
  put: jest.fn().mockResolvedValue({ data: { success: true } }),
  delete: jest.fn().mockResolvedValue({ data: { success: true } })
}));

export default {
  createUserHttpClient,
  createAuthHttpClient
};