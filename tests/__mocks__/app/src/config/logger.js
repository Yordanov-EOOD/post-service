import { jest } from '@jest/globals';

// Mock for logger.js

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
  
  // Additional methods that might be used
  profile: jest.fn(),
  startTimer: jest.fn(() => ({ done: jest.fn() })),
  
  // Performance logging methods
  logPerformance: jest.fn(),
  logRequest: jest.fn(),
  logError: jest.fn(),
  logAuth: jest.fn(),
  logDatabase: jest.fn(),
  logCache: jest.fn(),
  
  // Correlation tracking
  withCorrelationId: jest.fn(() => mockLogger),
  correlationId: 'test-correlation-id',
  
  // Health methods
  healthCheck: jest.fn(() => ({ status: 'healthy' })),
  
  // Export methods
  exportLogs: jest.fn(),
  archiveLogs: jest.fn()
};

// Export as both default and named export to handle both import styles
export default mockLogger;
export { mockLogger as logger };
