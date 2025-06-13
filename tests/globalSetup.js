/**
 * Global setup for Jest tests
 * Runs once before all test suites
 */

import dotenv from 'dotenv';

export default async function globalSetup() {
  console.log('🚀 Starting post-service test environment...');
  
  // Load test environment variables
  dotenv.config({ path: '.env.test' });
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Mock external services
  process.env.KAFKA_ENABLED = 'false';
  process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test database
  
  // Performance settings for tests
  process.env.CACHE_TTL = '300'; // Shorter TTL for tests
  process.env.PERFORMANCE_TRACKING = 'true';
  process.env.RATE_LIMIT_ENABLED = 'false'; // Disable rate limiting in tests
  
  console.log('✅ Test environment initialized');
  
  // Start any required test services
  try {
    // You could start test Redis, test database, etc. here
    console.log('🔧 Test services ready');
  } catch (error) {
    console.error('❌ Failed to start test services:', error);
    throw error;
  }
  
  console.log('🎯 Ready to run tests');
}
