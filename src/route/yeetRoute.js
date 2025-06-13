import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createYeet,
  getAllYeets,
  getYeetById,
  deleteYeet,
  likeYeet,
  retweetYeet,
  getUserTimeline,
  batchGetYeets
} from '../controllers/yeetController.js';

// Import middleware
import { 
  postValidation,
  handleValidationErrors,
  validatePostContent,
  validateCreatePost,
  validatePostId,
  validatePagination,
  validateBatchRequest
} from '../middleware/validation.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { securityHeaders, requestLogger } from '../middleware/security.js';
import logger from '../config/logger.js';

const router = Router();

// Apply security headers to all routes
router.use(securityHeaders);

// Apply request logging
router.use(requestLogger);

// Rate limiting configurations
const generalRateLimit = createRateLimit('general');
const writeRateLimit = createRateLimit('write'); 
const readRateLimit = createRateLimit('read');

// Add correlation tracking middleware
router.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  req.correlationId = correlationId;
  req.requestId = requestId;
  
  res.set('X-Correlation-ID', correlationId);
  res.set('X-Request-ID', requestId);
  
  next();
});

// Health check endpoint (no rate limiting)
router.get('/health', (req, res) => {
  logger.info('Health check requested', { 
    correlationId: req.correlationId,
    requestId: req.requestId
  });
  
  res.json({ 
    status: 'healthy', 
    service: 'post-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Batch operations (higher rate limit for efficiency)
router.post('/batch', 
  generalRateLimit,
  validateBatchRequest,
  batchGetYeets
);

// Write operations (stricter rate limiting)
router.post('/', 
  writeRateLimit,
  validateCreatePost,
  createYeet
);

router.delete('/:id', 
  writeRateLimit,
  validatePostId,
  deleteYeet
);

router.post('/:id/like', 
  writeRateLimit,
  validatePostId,
  likeYeet
);

router.post('/:id/retweet', 
  writeRateLimit,
  validatePostId,
  retweetYeet
);

// Read operations (more lenient rate limiting)
router.get('/', 
  readRateLimit,
  validatePagination,
  getAllYeets
);

router.get('/timeline', 
  readRateLimit,
  validatePagination,
  getUserTimeline
);

router.get('/:id', 
  readRateLimit,
  validatePostId,
  getYeetById
);

// Error handling middleware for routes
router.use((error, req, res, next) => {
  logger.error('Route error', {
    error: error.message,
    stack: error.stack,
    correlationId: req.correlationId,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.userId
  });

  // Don't leak sensitive information in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: isDevelopment ? error.message : 'Internal server error',
    requestId: req.requestId,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  });
});

export default router;