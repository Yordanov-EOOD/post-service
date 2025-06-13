import logger from '../config/logger.js';
import config from '../config/index.js';
import { performanceMonitor } from '../utils/performance.js';

/**
 * Enhanced error handler middleware with structured logging and correlation tracking
 */
export const errorHandler = (err, req, res, next) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Extract correlation ID and other context
  const correlationId = req.correlationId || 'unknown';
  const requestId = req.id || correlationId;
  const userId = req.user?.id || 'anonymous';
  const userAgent = req.get('User-Agent') || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  // Build error context
  const errorContext = {
    correlationId,
    requestId,
    userId,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent,
    ip,
    body: config.isDevelopment ? req.body : undefined,
    query: req.query,
    params: req.params,
    timestamp: new Date().toISOString(),
    duration: req.startTime ? Date.now() - req.startTime : undefined
  };

  // Determine error type and status
  let statusCode = 500;
  let errorType = 'InternalServerError';
  let message = 'An unexpected error occurred';
  let details = null;

  // Handle different error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'ValidationError';
    message = 'Invalid input data';
    details = err.details || err.message;
  } else if (err.name === 'UnauthorizedError' || err.status === 401) {
    statusCode = 401;
    errorType = 'UnauthorizedError';
    message = 'Authentication required';
  } else if (err.name === 'ForbiddenError' || err.status === 403) {
    statusCode = 403;
    errorType = 'ForbiddenError';
    message = 'Access denied';
  } else if (err.name === 'NotFoundError' || err.status === 404) {
    statusCode = 404;
    errorType = 'NotFoundError';
    message = 'Resource not found';
  } else if (err.name === 'ConflictError' || err.status === 409) {
    statusCode = 409;
    errorType = 'ConflictError';
    message = 'Resource conflict';
  } else if (err.name === 'RateLimitError' || err.status === 429) {
    statusCode = 429;
    errorType = 'RateLimitError';
    message = 'Rate limit exceeded';
    details = err.retryAfter ? { retryAfter: err.retryAfter } : null;
  } else if (err.status && err.status >= 400 && err.status < 500) {
    statusCode = err.status;
    errorType = 'ClientError';
    message = err.message || 'Client error';
  } else if (err.name === 'DatabaseError') {
    statusCode = 503;
    errorType = 'DatabaseError';
    message = 'Database service unavailable';
  } else if (err.name === 'CacheError') {
    statusCode = 503;
    errorType = 'CacheError';
    message = 'Cache service unavailable';
  } else if (err.name === 'ServiceUnavailableError' || err.status === 503) {
    statusCode = 503;
    errorType = 'ServiceUnavailableError';
    message = 'Service temporarily unavailable';
  } else if (err.status) {
    statusCode = err.status;
    errorType = 'HTTPError';
    message = err.message || `HTTP ${statusCode} Error`;
  } else if (err.message) {
    message = config.isDevelopment ? err.message : 'Internal server error';
  }

  // Build error response
  const errorResponse = {
    error: {
      type: errorType,
      message,
      correlationId,
      timestamp: new Date().toISOString()
    }
  };

  // Add details in development or for client errors
  if (config.isDevelopment || statusCode < 500) {
    if (details) {
      errorResponse.error.details = details;
    }
    if (config.isDevelopment && err.stack) {
      errorResponse.error.stack = err.stack;
    }
  }

  // Add rate limit headers if applicable
  if (statusCode === 429 && details?.retryAfter) {
    res.setHeader('Retry-After', details.retryAfter);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + details.retryAfter * 1000).toISOString());
  }

  // Log the error with appropriate level
  const logContext = {
    ...errorContext,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode
    }
  };

  if (statusCode >= 500) {
    // Server errors - log as error
    logger.error('Server error occurred', logContext);
  } else if (statusCode >= 400) {
    // Client errors - log as warning
    logger.warn('Client error occurred', logContext);
  } else {
    // Other cases - log as info
    logger.info('Request completed with error', logContext);
  }

  // Record performance metrics
  try {
    performanceMonitor.recordError(errorType, statusCode, errorContext.duration);
  } catch (perfError) {
    logger.warn('Failed to record error metrics', { 
      error: perfError.message,
      correlationId 
    });
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
  error.status = 404;
  error.name = 'NotFoundError';
  next(error);
};

/**
 * Custom error classes
 */
export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
  }
}

export class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message);
    this.name = 'RateLimitError';
    this.status = 429;
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends Error {
  constructor(message = 'Database error') {
    super(message);
    this.name = 'DatabaseError';
    this.status = 503;
  }
}

export class CacheError extends Error {
  constructor(message = 'Cache error') {
    super(message);
    this.name = 'CacheError';
    this.status = 503;
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message = 'Service temporarily unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.status = 503;
  }
}