#!/usr/bin/env node

/**
 * Cache management utility script
 * Provides tools for cache maintenance and management
 */

import { cacheService } from '../src/utils/cache.js';
import logger from '../src/config/logger.js';
import config from '../src/config/index.js';

const scriptLogger = logger.child({ script: 'clearCache' });

class CacheManager {
  constructor() {
    this.cache = cacheService;
  }

  /**
   * Clear all cache data
   */
  async clearAll() {
    try {
      scriptLogger.info('Starting cache clear operation');
      
      const result = await this.cache.clearAll();
      
      scriptLogger.info('Cache cleared successfully', {
        cleared: result.cleared,
        errors: result.errors
      });
      
      return result;
    } catch (error) {
      scriptLogger.error('Failed to clear cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear specific cache patterns
   */
  async clearPattern(pattern) {
    try {
      scriptLogger.info('Clearing cache pattern', { pattern });
      
      const result = await this.cache.clearPattern(pattern);
      
      scriptLogger.info('Cache pattern cleared', {
        pattern,
        keysCleared: result.keysCleared
      });
      
      return result;
    } catch (error) {
      scriptLogger.error('Failed to clear cache pattern', { 
        pattern, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const stats = await this.cache.getStats();
      
      console.log('\n=== CACHE STATISTICS ===');
      console.log(`Total Keys: ${stats.totalKeys}`);
      console.log(`Memory Usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
      console.log(`Miss Rate: ${(stats.missRate * 100).toFixed(2)}%`);
      
      if (stats.keysByType) {
        console.log('\n--- Keys by Type ---');
        Object.entries(stats.keysByType).forEach(([type, count]) => {
          console.log(`${type}: ${count} keys`);
        });
      }
      
      console.log('========================\n');
      
      return stats;
    } catch (error) {
      scriptLogger.error('Failed to get cache stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Warm up cache with common data
   */
  async warmUp() {
    try {
      scriptLogger.info('Starting cache warm-up');
      
      // This would typically pre-load frequently accessed data
      // Implementation depends on your specific use case
      
      scriptLogger.info('Cache warm-up completed');
    } catch (error) {
      scriptLogger.error('Cache warm-up failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Cleanup expired keys and optimize cache
   */
  async optimize() {
    try {
      scriptLogger.info('Starting cache optimization');
      
      const result = await this.cache.optimize();
      
      scriptLogger.info('Cache optimization completed', {
        expiredKeysRemoved: result.expiredKeysRemoved,
        memoryFreed: result.memoryFreed
      });
      
      return result;
    } catch (error) {
      scriptLogger.error('Cache optimization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize cache connection
   */
  async initialize() {
    try {
      await this.cache.initialize();
      scriptLogger.info('Cache connection initialized');
    } catch (error) {
      scriptLogger.error('Failed to initialize cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Close cache connection
   */
  async close() {
    try {
      await this.cache.close();
      scriptLogger.info('Cache connection closed');
    } catch (error) {
      scriptLogger.error('Failed to close cache connection', { error: error.message });
    }
  }
}

// Command line interface
async function main() {
  const manager = new CacheManager();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    await manager.initialize();

    switch (command) {
      case 'clear':
        if (args[0] === 'all') {
          await manager.clearAll();
        } else if (args[0]) {
          await manager.clearPattern(args[0]);
        } else {
          console.log('Usage: npm run cache:clear <all|pattern>');
          process.exit(1);
        }
        break;

      case 'stats':
        await manager.getStats();
        break;

      case 'warmup':
        await manager.warmUp();
        break;

      case 'optimize':
        await manager.optimize();
        break;

      default:
        console.log(`
Cache Management Utility

Available commands:
  clear all           - Clear all cache data
  clear <pattern>     - Clear cache keys matching pattern
  stats              - Show cache statistics
  warmup             - Warm up cache with common data
  optimize           - Clean up expired keys and optimize cache

Examples:
  npm run cache:clear all
  npm run cache:clear "posts:*"
  npm run cache:stats
  npm run cache:warmup
  npm run cache:optimize
        `);
        break;
    }
  } catch (error) {
    scriptLogger.error('Script execution failed', { 
      command, 
      args, 
      error: error.message 
    });
    process.exit(1);
  } finally {
    await manager.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  scriptLogger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  scriptLogger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default CacheManager;
