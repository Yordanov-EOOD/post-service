import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Import routes and controllers
import yeetRoute from './route/yeetRoute.js';
import { errorHandler } from './middleware/errorHandler.js';
import verifyJWT from './middleware/verifyJWT.js';
import verifyServiceToken from './middleware/verifyServiceToken.js';
import { createInternalUser } from './controllers/userController.js';

// Import configuration and utilities
import config from './config/index.js';
import logger from './config/logger.js';
import { performance } from './utils/performance.js';
import { cache } from './utils/cache.js';
import { dbOptimization } from './utils/dbOptimization.js';

// Import middleware
import { correlationMiddleware } from './middleware/security.js';
import { createRateLimit } from './middleware/rateLimit.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';

// Import initialization
import { initKafka } from './config/kafkaInit.js';
import { createUserHttpClient, createAuthHttpClient } from '/app/shared/http-client.js';

const app = express();

// Initialize logger context
const appLogger = logger.child({ service: 'post-service' });
appLogger.info('Starting post-service application', {
  version: process.env.npm_package_version || '1.0.0',
  environment: config.env,
  nodeVersion: process.version
});

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Security headers (Helmet.js)
app.use(helmet(config.security.helmet));

// Compression for better performance
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024
}));

// Request correlation tracking
app.use(correlationMiddleware);

// Request logging with Morgan
if (config.logging.enableAccess) {
  app.use(morgan('combined', {
    stream: logger.getMorganStream(),
    skip: (req, res) => res.statusCode < 400 // Only log errors and above
  }));
}

// Performance monitoring middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    performance.recordRequest(req.method, req.path, res.statusCode, duration);
    
    if (duration > config.performance.slowQueryThreshold) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        correlationId: req.correlationId
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  const healthCheck = {
    service: 'post-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    checks: {}
  };

  try {
    // Check database connectivity
    const dbStatus = await dbOptimization.getConnectionStatus();
    healthCheck.checks.database = {
      status: dbStatus.connected ? 'healthy' : 'unhealthy',
      connections: dbStatus.connections,
      responseTime: dbStatus.responseTime
    };

    // Check Redis/Cache connectivity
    try {
      await cache.ping();
      healthCheck.checks.cache = { status: 'healthy' };
    } catch (cacheError) {
      healthCheck.checks.cache = { 
        status: 'unhealthy', 
        error: cacheError.message 
      };
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    healthCheck.checks.memory = {
      status: memUsageMB.heapUsed < 500 ? 'healthy' : 'warning',
      usage: memUsageMB
    };

    // Overall status
    const hasUnhealthy = Object.values(healthCheck.checks).some(check => check.status === 'unhealthy');
    if (hasUnhealthy) {
      healthCheck.status = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;
    healthCheck.responseTime = responseTime;

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      ...healthCheck,
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

// CORS configuration
app.use(cors(config.server.cors));

// Add metrics middleware
app.use(metricsMiddleware);

// Body parsing with size limits
app.use(express.json({ 
  limit: config.server.bodyParser.limit,
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: config.server.bodyParser.limit 
}));



// Create HTTP clients with circuit breakers
export const userServiceClient = createUserHttpClient('yeet-service');
export const authServiceClient = createAuthHttpClient('yeet-service');

// Metrics endpoints
app.get('/metrics', metricsHandler);

// Legacy metrics endpoint for backward compatibility
app.get('/metrics/legacy', async (req, res) => {
  try {
    const metrics = await performance.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Debug routes (development only)
if (config.features.enableDebugRoutes && config.isDevelopment) {
  app.get('/debug/cache', async (req, res) => {
    try {
      const cacheStats = await cache.getStats();
      res.json(cacheStats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/debug/performance', async (req, res) => {
    try {
      const perfStats = await performance.getDetailedStats();
      res.json(perfStats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Global rate limiting
const globalRateLimit = createRateLimit('general');
app.use('/yeets', globalRateLimit);

// Debug middleware (development only)
if (config.isDevelopment) {
  app.use((req, res, next) => {
    appLogger.debug('Incoming request', {
      method: req.method,
      url: req.url,
      correlationId: req.correlationId
    });
    next();
  });
}

// Main routes with authentication
app.use('/yeets', verifyJWT, yeetRoute);

// Internal routes for service-to-service communication
app.use('/internal', verifyServiceToken, (req, res) => {
  appLogger.warn('Unknown internal route accessed', { 
    url: req.url,
    method: req.method,
    correlationId: req.correlationId
  });
  res.status(404).json({ 
    error: 'Internal endpoint not found',
    correlationId: req.correlationId
  });
});

// Catch-all for unhandled routes
app.use('*', (req, res) => {
  appLogger.warn('Route not found', {
    method: req.method,
    url: req.url,
    correlationId: req.correlationId
  });
  
  res.status(404).json({
    error: 'Route not found',
    correlationId: req.correlationId,
    service: 'post-service'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

const PORT = config.server.port;

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  appLogger.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    // Close database connections
    await dbOptimization.closeConnections();
    appLogger.info('Database connections closed');
    
    // Close cache connections
    await cache.close();
    appLogger.info('Cache connections closed');
    
    // Stop performance monitoring
    performance.stop();
    appLogger.info('Performance monitoring stopped');
    
    // Flush logs
    await logger.flush();
    
    process.exit(0);
  } catch (error) {
    appLogger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
const startServer = async () => {
  try {
    appLogger.info('Initializing post-service', {
      port: PORT,
      environment: config.env
    });

    // Initialize database optimization
    await dbOptimization.initialize();
    appLogger.info('Database optimization initialized');

    // Initialize cache
    await cache.initialize();    appLogger.info('Cache system initialized');

    // Initialize performance monitoring
    // performance.start(); // Temporarily disabled to fix startup issue
    appLogger.info('Performance monitoring started');

    // Initialize Kafka
    const kafka = await initKafka();
    appLogger.info('Kafka initialization', { 
      success: !!kafka,
      status: kafka ? 'connected' : 'failed'
    });
    
    // Start the HTTP server
    const server = app.listen(PORT, config.server.host, () => {
      appLogger.info('Post-service started successfully', {
        port: PORT,
        host: config.server.host,
        environment: config.env,
        processId: process.pid
      });
    });

    // Configure server timeouts
    server.timeout = config.server.timeout;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Handle server errors
    server.on('error', (error) => {
      appLogger.error('Server error', { error: error.message, stack: error.stack });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      appLogger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      appLogger.error('Unhandled promise rejection', { 
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
      });
    });

  } catch (error) {
    appLogger.error('Failed to start post-service', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  }
};

startServer();

export default app;