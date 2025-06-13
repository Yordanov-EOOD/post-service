/**
 * Test setup and global configuration
 */

import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test configuration
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.CACHE_ENABLED = 'true';
process.env.PERFORMANCE_TRACKING = 'true';

// Mock external dependencies that we don't want to test
jest.mock('../src/config/kafkaInit.js', () => ({
  initKafka: jest.fn().mockResolvedValue({ connected: true })
}));

jest.mock('../../shared/http-client.js', () => ({
  createUserHttpClient: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  })),
  createAuthHttpClient: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }))
}));

// Global test utilities
global.testUtils = {
  // Generate test data
  generateTestYeet: (overrides = {}) => ({
    id: 'test-yeet-id',
    content: 'This is a test yeet',
    userId: 'test-user-id',
    username: 'testuser',
    createdAt: new Date().toISOString(),
    likes: 0,
    replies: 0,
    reposts: 0,
    ...overrides
  }),

  generateTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  // Test data generators
  generateBulkYeets: (count) => {
    return Array(count).fill().map((_, i) => ({
      id: `test-yeet-${i}`,
      content: `Test yeet content ${i}`,
      userId: `test-user-${i % 10}`, // 10 different users
      username: `testuser${i % 10}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      likes: Math.floor(Math.random() * 100),
      replies: Math.floor(Math.random() * 20),
      reposts: Math.floor(Math.random() * 50)
    }));
  },

  // Wait utility for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock response helpers
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };
    res.locals = {};
    return res;
  },

  createMockRequest: (overrides = {}) => ({
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: {},
    query: {},
    params: {},
    body: {},
    user: {
      id: 'test-user-id',
      username: 'testuser'
    },
    correlationId: 'test-correlation-id',
    startTime: Date.now(),
    ...overrides
  }),

  // Performance test helpers
  measurePerformance: async (fn, iterations = 1) => {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      results.push(Number(end - start) / 1000000); // Convert to milliseconds
    }
    
    return {
      results,
      average: results.reduce((a, b) => a + b, 0) / results.length,
      min: Math.min(...results),
      max: Math.max(...results)
    };
  }
};

// Global test database helpers
global.testDb = {
  // Mock database client for tests
  createMockPrisma: () => ({
    yeet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn()
  }),

  // Mock Redis client for tests
  createMockRedis: () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn(),
    flushall: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
    pipeline: jest.fn(() => ({
      get: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    })),
    eval: jest.fn()
  })
};

// Global beforeEach for all tests
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset environment variables that might be modified in tests
  process.env.NODE_ENV = 'test';
  
  // Clear console to reduce noise
  if (process.env.JEST_SILENT !== 'false') {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }
});

// Global afterEach for all tests
afterEach(() => {
  // Restore console
  if (console.log.mockRestore) {
    console.log.mockRestore();
  }
  if (console.info.mockRestore) {
    console.info.mockRestore();
  }
  if (console.warn.mockRestore) {
    console.warn.mockRestore();
  }
  if (console.error.mockRestore) {
    console.error.mockRestore();
  }
});

// Add any global test setup here
beforeAll(async () => {
  console.log('Starting post-service test setup...');
  // Any setup that needs to run before all tests
  // Could include database setup, mock services initialization, etc.
});

// Clean up after all tests
afterAll(async () => {
  console.log('Cleaning up after post-service tests...');
  // Any cleanup needed after tests
  // Could include closing database connections, stopping mock servers, etc.
});