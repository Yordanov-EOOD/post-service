// Test application module for integration tests
import express from 'express';
import cors from 'cors';
import { jest } from '@jest/globals';
import yeetRoute from '../src/route/yeetRoute.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createInternalUser } from '../src/controllers/userController.js';

// Set dummy environment variables for testing
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'testdb';
process.env.DB_USER = 'testuser';
process.env.DB_PASS = 'testpass';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.KAFKA_BROKER = 'localhost:9092';
process.env.JWT_SECRET = 'testsecret';
process.env.SERVICE_TOKEN_SECRET = 'testservicetoken';

// Mock Kafka initialization first (before anything else imports it)
jest.mock('../src/config/kafkaInit.js', () => ({
  initKafka: jest.fn().mockResolvedValue({ connected: true })
}));

// Mock the shared http-client module
jest.mock('/app/shared/http-client.js', () => ({
  createUserHttpClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} })
  })),
  createAuthHttpClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} })
  }))
}));

// Mock Prisma database operations
jest.mock('../src/config/db.js', () => ({
  default: {
    yeet: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'mock-yeet-id' }),
      update: jest.fn().mockResolvedValue({ id: 'mock-yeet-id' }),
      delete: jest.fn().mockResolvedValue({ id: 'mock-yeet-id' }),
      count: jest.fn().mockResolvedValue(0)
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
      update: jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
      delete: jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
      count: jest.fn().mockResolvedValue(0)
    },
    $disconnect: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock the cache service
jest.mock('../src/utils/cache.js', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    ping: jest.fn().mockResolvedValue('PONG'),
    initialize: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockResolvedValue({ hits: 0, misses: 0 })
  }
}));

// Mock DB optimization
jest.mock('../src/utils/dbOptimization.js', () => ({
  dbOptimization: {
    initialize: jest.fn().mockResolvedValue(true),
    closeConnections: jest.fn().mockResolvedValue(true),
    getConnectionStatus: jest.fn().mockResolvedValue({
      connected: true,
      connections: 5,
      responseTime: 10
    })
  }
}));

// Mock config
jest.mock('../src/config/index.js', () => ({
  default: {
    env: 'test',
    server: {
      cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token']
      },
      bodyParser: {
        limit: '10mb'
      },
      timeout: 30000,
      host: '0.0.0.0'
    },
    security: {
      helmet: {}
    },
    logging: {
      enableAccess: false
    },
    performance: {
      slowQueryThreshold: 1000
    },
    features: {
      enableMetrics: false,
      enableDebugRoutes: false
    },
    isDevelopment: false
  }
}));

// Mock logger
jest.mock('../src/config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })),
    getMorganStream: jest.fn(() => ({ write: jest.fn() })),
    flush: jest.fn().mockResolvedValue()
  }
}));

// Mock middleware
jest.mock('../src/middleware/verifyJWT.js', () => ({
  default: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', username: 'testuser' };
    next();
  })
}));

jest.mock('../src/middleware/verifyServiceToken.js', () => ({
  default: jest.fn((req, res, next) => {
    next();
  })
}));

// Mock performance monitor
jest.mock('../src/utils/performance.js', () => ({
  performance: {
    recordRequest: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue({
      summary: { totalRequests: 0, totalErrors: 0, avgResponseTime: 0 },
      requests: {},
      database: {},
      cache: {},
      errors: {},
      system: { uptime: 100, memory: { rss: 50, heapUsed: 30 } }
    }),
    getDetailedStats: jest.fn().mockResolvedValue({
      summary: { totalRequests: 0, totalErrors: 0, avgResponseTime: 0 },
      requests: {},
      database: {},
      cache: {},
      errors: {},
      system: { uptime: 100, memory: { rss: 50, heapUsed: 30 } }
    }),
    start: jest.fn(),
    stop: jest.fn()
  },
  performanceMonitor: {
    startTracking: jest.fn().mockReturnValue('mock-tracking-id'),
    endTracking: jest.fn().mockReturnValue({ duration: 100 }),
    recordError: jest.fn().mockReturnValue(true),
    startRequest: jest.fn().mockReturnValue('mock-request-id'),
    endRequest: jest.fn().mockReturnValue({ duration: 100 }),
    recordRequest: jest.fn()
  }
}));

// Create test versions of middleware
const testVerifyJWT = (req, res, next) => {
  // Set mock user data for authorized requests
  req.user = {
    userId: 'test-user-id',
    username: 'testuser'
  };
  next();
};

const testVerifyServiceToken = (req, res, next) => {
  // Always authorize service token in tests
  next();
};

// Create a test application instance without starting the server
export function createTestApp() {
  const app = express();

  // Basic middleware setup
  app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token']
  }));

  app.use(express.json());

  // Enhanced health check endpoint that matches the main app
  app.get('/health', async (req, res) => {
    const healthCheck = {
      service: 'post-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: 'test',
      checks: {
        database: {
          status: 'healthy',
          connections: 5,
          responseTime: 10
        },
        cache: {
          status: 'healthy'
        },
        memory: {
          status: 'healthy',
          usage: {
            rss: 50,
            heapTotal: 30,
            heapUsed: 20,
            external: 5
          }
        }
      },
      responseTime: 5
    };

    res.status(200).json(healthCheck);
  });

  // Regular routes - no rate limiters for testing, use the test middleware
  app.use('/yeets', testVerifyJWT, yeetRoute);

  // Internal routes - no rate limiters for testing, use the test middleware
  app.post('/internal/users', testVerifyServiceToken, (req, res) => {
    createInternalUser(req, res);
  });

  app.use(errorHandler);

  return app;
}
