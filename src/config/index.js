import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

/**
 * Centralized Configuration Management
 * Validates and provides typed access to all environment variables
 */
class Configuration {
  constructor() {
    this.validateRequiredVariables();
    this.initializeConfig();
  }

  /**
   * Validate that all required environment variables are present
   */
  validateRequiredVariables() {    
    const required = [
      'NODE_ENV',
      'PORT',
      'DB_HOST',
      'DB_PORT',      
      'DB_NAME',
      'DB_USER',
      'DB_PASS',
      'ACCESS_TOKEN_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Initialize configuration with defaults and type conversions
   */
  initializeConfig() {
    // Environment
    this.env = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.env === 'development';
    this.isProduction = this.env === 'production';
    this.isTesting = this.env === 'test';    // Server Configuration
    this.server = {
      port: parseInt(process.env.PORT, 10) || 3000,
      host: '0.0.0.0',
      cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
        credentials: true
      },
      bodyParser: {
        limit: process.env.BODY_LIMIT || '10mb'
      },
      timeout: parseInt(process.env.SERVER_TIMEOUT, 10) || 30000
    };

    // Database Configuration
    this.database = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      dialect: 'postgres',
      pool: {
        max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
        min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000
      },
      logging: !this.isProduction,
      dialectOptions: this.isProduction ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    };

    // Redis Configuration    // Authentication & Security
    this.auth = {
      jwtSecret: process.env.ACCESS_TOKEN_SECRET,
      jwtExpiry: process.env.JWT_EXPIRY || '24h',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
      sessionSecret: process.env.SESSION_SECRET || 'default-session-secret'
    };

    // Rate Limiting Configuration
    this.rateLimit = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 900000, // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
      skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true',
      standardHeaders: true,
      legacyHeaders: false,
      // Tier-specific limits
      tiers: {
        basic: {
          requests: parseInt(process.env.RATE_LIMIT_BASIC, 10) || 100,
          window: parseInt(process.env.RATE_LIMIT_BASIC_WINDOW, 10) || 900000
        },
        premium: {
          requests: parseInt(process.env.RATE_LIMIT_PREMIUM, 10) || 500,
          window: parseInt(process.env.RATE_LIMIT_PREMIUM_WINDOW, 10) || 900000
        },
        api: {
          requests: parseInt(process.env.RATE_LIMIT_API, 10) || 1000,
          window: parseInt(process.env.RATE_LIMIT_API_WINDOW, 10) || 900000
        }
      }
    };

    // Cache Configuration
    this.cache = {
      enabled: process.env.CACHE_ENABLED !== 'false',
      type: process.env.CACHE_TYPE || 'redis', // 'redis' or 'memory'
      ttl: {
        posts: parseInt(process.env.CACHE_TTL_POSTS, 10) || 1800,
        users: parseInt(process.env.CACHE_TTL_USERS, 10) || 3600,
        timelines: parseInt(process.env.CACHE_TTL_TIMELINES, 10) || 900,
        queries: parseInt(process.env.CACHE_TTL_QUERIES, 10) || 300
      },
      maxSize: {
        posts: parseInt(process.env.CACHE_MAX_POSTS, 10) || 500,
        users: parseInt(process.env.CACHE_MAX_USERS, 10) || 200,
        timelines: parseInt(process.env.CACHE_MAX_TIMELINES, 10) || 100,
        queries: parseInt(process.env.CACHE_MAX_QUERIES, 10) || 1000
      }
    };

    // Performance Monitoring
    this.performance = {
      enabled: process.env.PERFORMANCE_MONITORING !== 'false',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD, 10) || 1000,
      memoryWarningThreshold: parseInt(process.env.MEMORY_WARNING_THRESHOLD, 10) || 80,
      cpuWarningThreshold: parseInt(process.env.CPU_WARNING_THRESHOLD, 10) || 80,
      metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS, 10) || 30
    };

    // Logging Configuration
    this.logging = {
      level: process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info'),
      format: process.env.LOG_FORMAT || 'combined',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE === 'true',
      filePath: process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs'),
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 14,
      enableError: process.env.LOG_ERROR !== 'false',
      enableAccess: process.env.LOG_ACCESS !== 'false',
      enableSecurity: process.env.LOG_SECURITY !== 'false',
      enablePerformance: process.env.LOG_PERFORMANCE !== 'false'
    };

    // Security Configuration
    this.security = {
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"]
          }
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      },
      cors: {
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      },
      validation: {
        maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH, 10) || 500,
        allowedFileTypes: process.env.ALLOWED_FILE_TYPES ? 
          process.env.ALLOWED_FILE_TYPES.split(',') : 
          ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 // 5MB
      }
    };

    // External Services
    this.external = {
      authService: {
        url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
        timeout: parseInt(process.env.AUTH_SERVICE_TIMEOUT, 10) || 5000
      },
      userService: {
        url: process.env.USER_SERVICE_URL || 'http://localhost:3003',
        timeout: parseInt(process.env.USER_SERVICE_TIMEOUT, 10) || 5000
      }
    };

    // Feature Flags
    this.features = {
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
      enableSwagger: process.env.ENABLE_SWAGGER === 'true' || this.isDevelopment,
      enableProfiler: process.env.ENABLE_PROFILER === 'true' && this.isDevelopment,
      enableDebugRoutes: process.env.ENABLE_DEBUG_ROUTES === 'true' && this.isDevelopment
    };
  }

  /**
   * Get configuration for a specific section
   * @param {string} section - Configuration section name
   * @returns {object} Section configuration
   */
  get(section) {
    return this[section] || {};
  }

  /**
   * Check if running in development mode
   * @returns {boolean}
   */
  isDev() {
    return this.isDevelopment;
  }

  /**
   * Check if running in production mode
   * @returns {boolean}
   */
  isProd() {
    return this.isProduction;
  }

  /**
   * Check if running in test mode
   * @returns {boolean}
   */
  isTest() {
    return this.isTesting;
  }

  /**
   * Get database configuration for Sequelize
   * @returns {object} Sequelize configuration
   */
  getDatabaseConfig() {
    return {
      ...this.database,
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
      }
    };
  }



  /**
   * Validate configuration integrity
   * @returns {object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Port validation
    if (this.server.port < 1024 || this.server.port > 65535) {
      warnings.push('Server port should be between 1024 and 65535');
    }

    // Database pool validation
    if (this.database.pool.max < this.database.pool.min) {
      errors.push('Database pool max must be greater than min');
    }

    // JWT secret validation
    if (this.auth.jwtSecret.length < 32) {
      warnings.push('JWT secret should be at least 32 characters long');
    }

    // Cache configuration validation
    if (this.cache.enabled && this.cache.type !== 'redis' && this.cache.type !== 'memory') {
      errors.push('Cache type must be either "redis" or "memory"');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Create and export singleton instance
const config = new Configuration();

// Validate configuration on startup
const validation = config.validate();
if (!validation.valid) {
  console.error('Configuration validation failed:', validation.errors);
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings);
}

export default config;
