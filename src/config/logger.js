import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from './index.js';

/**
 * Enhanced Logging System with Winston
 * Provides structured logging with multiple outputs and correlation tracking
 */
class Logger {
  constructor() {
    this.createLogDirectories();
    this.initializeLoggers();
    this.setupGlobalErrorHandling();
  }

  /**
   * Create log directories if they don't exist
   */
  createLogDirectories() {
    const logsDir = config.logging.filePath;
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Initialize Winston loggers with different configurations
   */
  initializeLoggers() {
    // Custom format for structured logging
    const customFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
      winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
        let log = `${timestamp} [${level.toUpperCase()}]`;
        
        // Add correlation ID if present
        if (metadata.correlationId) {
          log += ` [${metadata.correlationId}]`;
        }
        
        // Add request ID if present
        if (metadata.requestId) {
          log += ` [REQ:${metadata.requestId}]`;
        }
        
        // Add user ID if present
        if (metadata.userId) {
          log += ` [USER:${metadata.userId}]`;
        }
        
        log += `: ${message}`;
        
        // Add metadata if present
        const metaKeys = Object.keys(metadata).filter(key => 
          !['correlationId', 'requestId', 'userId'].includes(key)
        );
        if (metaKeys.length > 0) {
          const metaObj = {};
          metaKeys.forEach(key => {
            metaObj[key] = metadata[key];
          });
          log += ` | META: ${JSON.stringify(metaObj)}`;
        }
        
        // Add stack trace for errors
        if (stack) {
          log += `\n${stack}`;
        }
        
        return log;
      })
    );

    // JSON format for structured log analysis
    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
      winston.format.json()
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, metadata }) => {
        let log = `${timestamp} ${level}: ${message}`;
        if (metadata.correlationId) {
          log += ` [${metadata.correlationId.substring(0, 8)}]`;
        }
        return log;
      })
    );

    // Base transports
    const transports = [];

    // Console transport (always enabled in development)
    if (config.logging.enableConsole || config.isDevelopment) {
      transports.push(new winston.transports.Console({
        format: config.isDevelopment ? consoleFormat : jsonFormat,
        level: config.logging.level
      }));
    }

    // File transports
    if (config.logging.enableFile) {
      // Combined log file
      transports.push(new winston.transports.File({
        filename: path.join(config.logging.filePath, 'combined.log'),
        format: customFormat,
        maxsize: config.logging.maxSize,
        maxFiles: config.logging.maxFiles,
        level: config.logging.level
      }));

      // Error log file
      if (config.logging.enableError) {
        transports.push(new winston.transports.File({
          filename: path.join(config.logging.filePath, 'error.log'),
          format: customFormat,
          maxsize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles,
          level: 'error'
        }));
      }
    }

    // Main application logger
    this.appLogger = winston.createLogger({
      level: config.logging.level,
      format: customFormat,
      transports,
      exitOnError: false
    });

    // Access logger for HTTP requests
    if (config.logging.enableAccess) {
      this.accessLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({
            filename: path.join(config.logging.filePath, 'access.log'),
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
          })
        ]
      });
    }

    // Security logger for security events
    if (config.logging.enableSecurity) {
      this.securityLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({
            filename: path.join(config.logging.filePath, 'security.log'),
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
          })
        ]
      });
    }

    // Performance logger for performance metrics
    if (config.logging.enablePerformance) {
      this.performanceLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({
            filename: path.join(config.logging.filePath, 'performance.log'),
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
          })
        ]
      });
    }
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.error('Unhandled Rejection', { 
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString()
      });
    });
  }

  /**
   * Create logger with context
   * @param {object} context - Context information (correlationId, requestId, userId)
   * @returns {object} Contextual logger
   */
  child(context = {}) {
    return {
      debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
      info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
      error: (message, meta = {}) => this.error(message, { ...context, ...meta })
    };
  }

  /**
   * Debug level logging
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.appLogger.debug(message, meta);
  }

  /**
   * Info level logging
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.appLogger.info(message, meta);
  }

  /**
   * Warning level logging
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.appLogger.warn(message, meta);
  }

  /**
   * Error level logging
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  error(message, meta = {}) {
    this.appLogger.error(message, meta);
  }

  /**
   * Log HTTP access
   * @param {object} requestInfo - Request information
   */
  access(requestInfo) {
    if (this.accessLogger) {
      this.accessLogger.info('HTTP Request', requestInfo);
    }
  }

  /**
   * Log security events
   * @param {string} event - Security event type
   * @param {object} details - Event details
   */
  security(event, details = {}) {
    if (this.securityLogger) {
      this.securityLogger.info(event, {
        ...details,
        timestamp: new Date().toISOString(),
        severity: details.severity || 'medium'
      });
    }
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {object} metrics - Performance metrics
   */
  performance(operation, metrics = {}) {
    if (this.performanceLogger) {
      this.performanceLogger.info(operation, {
        ...metrics,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Log database query performance
   * @param {string} query - SQL query
   * @param {number} duration - Query duration in ms
   * @param {object} meta - Additional metadata
   */
  queryPerformance(query, duration, meta = {}) {
    const isSlowQuery = duration > config.performance.slowQueryThreshold;
    
    this.performance('Database Query', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration,
      isSlowQuery,
      ...meta
    });

    if (isSlowQuery) {
      this.warn('Slow Query Detected', {
        query,
        duration,
        threshold: config.performance.slowQueryThreshold,
        ...meta
      });
    }
  }

  /**
   * Log cache operations
   * @param {string} operation - Cache operation (hit, miss, set, delete)
   * @param {string} key - Cache key
   * @param {object} meta - Additional metadata
   */
  cache(operation, key, meta = {}) {
    this.debug(`Cache ${operation.toUpperCase()}`, {
      operation,
      key,
      ...meta
    });
  }

  /**
   * Log rate limiting events
   * @param {string} identifier - User/IP identifier
   * @param {string} endpoint - Endpoint being rate limited
   * @param {object} details - Rate limit details
   */
  rateLimit(identifier, endpoint, details = {}) {
    this.security('Rate Limit', {
      identifier,
      endpoint,
      ...details,
      severity: details.blocked ? 'high' : 'medium'
    });

    if (details.blocked) {
      this.warn('Rate Limit Exceeded', {
        identifier,
        endpoint,
        ...details
      });
    }
  }

  /**
   * Log validation errors
   * @param {string} field - Field that failed validation
   * @param {string} value - Invalid value
   * @param {string} rule - Validation rule that failed
   * @param {object} meta - Additional metadata
   */
  validation(field, value, rule, meta = {}) {
    this.security('Validation Failed', {
      field,
      value: typeof value === 'string' ? value.substring(0, 100) : value,
      rule,
      ...meta,
      severity: 'low'
    });
  }

  /**
   * Log authentication events
   * @param {string} event - Auth event type (login, logout, failed_login, etc.)
   * @param {string} userId - User ID
   * @param {object} details - Event details
   */
  auth(event, userId, details = {}) {
    this.security('Authentication', {
      event,
      userId,
      ...details,
      severity: event.includes('failed') ? 'high' : 'medium'
    });
  }

  /**
   * Create Express.js morgan stream for access logging
   * @returns {object} Morgan stream
   */
  getMorganStream() {
    return {
      write: (message) => {
        this.access(message.trim());
      }
    };
  }

  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLevel() {
    return this.appLogger.level;
  }

  /**
   * Set log level
   * @param {string} level - New log level
   */
  setLevel(level) {
    this.appLogger.level = level;
    this.info('Log level changed', { oldLevel: this.getLevel(), newLevel: level });
  }

  /**
   * Flush all logs (useful for testing)
   */
  flush() {
    return new Promise((resolve) => {
      let pending = 0;
      const loggers = [this.appLogger, this.accessLogger, this.securityLogger, this.performanceLogger]
        .filter(logger => logger);

      if (loggers.length === 0) {
        return resolve();
      }

      loggers.forEach(logger => {
        logger.transports.forEach(transport => {
          if (transport.close) {
            pending++;
            transport.close(() => {
              pending--;
              if (pending === 0) resolve();
            });
          }
        });
      });

      if (pending === 0) resolve();
    });
  }
}

// Create and export singleton instance
const logger = new Logger();

export default logger;
