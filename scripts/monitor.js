#!/usr/bin/env node

/**
 * Post-service monitoring and maintenance utility
 * Provides comprehensive monitoring, maintenance, and diagnostic tools
 */

import { cacheService } from '../src/utils/cache.js';
import { dbOptimization } from '../src/utils/dbOptimization.js';
import { performanceTracker } from '../src/utils/performance.js';
import logger from '../src/config/logger.js';
import config from '../src/config/index.js';

const scriptLogger = logger.child({ script: 'monitor' });

class ServiceMonitor {
  constructor() {
    this.isRunning = false;
    this.intervals = new Map();
  }

  /**
   * Start comprehensive monitoring
   */
  async start(options = {}) {
    const {
      interval = 30000, // 30 seconds
      detailed = false,
      alerts = true
    } = options;

    if (this.isRunning) {
      console.log('⚠️  Monitor is already running');
      return;
    }

    console.log('🚀 Starting post-service monitor...');
    this.isRunning = true;

    try {
      // Initialize connections
      await this.initialize();

      // Start monitoring intervals
      this.intervals.set('health', setInterval(() => {
        this.checkHealth(detailed);
      }, interval));

      this.intervals.set('performance', setInterval(() => {
        this.checkPerformance(alerts);
      }, interval * 2)); // Less frequent

      this.intervals.set('resources', setInterval(() => {
        this.checkResources(alerts);
      }, interval * 3)); // Even less frequent

      console.log(`✅ Monitor started (interval: ${interval}ms)`);
      console.log('Press Ctrl+C to stop monitoring');

      // Keep the process alive
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());

    } catch (error) {
      scriptLogger.error('Failed to start monitor', { error: error.message });
      this.stop();
      process.exit(1);
    }
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('\n🛑 Stopping monitor...');
    this.isRunning = false;

    // Clear all intervals
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      scriptLogger.debug(`Stopped ${name} monitoring`);
    });
    this.intervals.clear();

    // Close connections
    try {
      await cacheService.close();
      await dbOptimization.closeConnections();
      performanceTracker.stop();
    } catch (error) {
      scriptLogger.warn('Error during cleanup', { error: error.message });
    }

    console.log('✅ Monitor stopped');
    process.exit(0);
  }

  /**
   * Initialize monitoring connections
   */
  async initialize() {
    scriptLogger.info('Initializing monitoring connections');

    await cacheService.initialize();
    await dbOptimization.initialize();
    performanceTracker.start();

    scriptLogger.info('Monitoring connections initialized');
  }

  /**
   * Check overall system health
   */
  async checkHealth(detailed = false) {
    const timestamp = new Date().toISOString();
    const health = {
      timestamp,
      status: 'healthy',
      checks: {}
    };

    try {
      // Database health
      const dbStatus = await dbOptimization.getConnectionStatus();
      health.checks.database = {
        status: dbStatus.connected ? 'healthy' : 'unhealthy',
        connections: dbStatus.connections,
        responseTime: dbStatus.responseTime
      };

      // Cache health
      try {
        const cacheStart = Date.now();
        await cacheService.ping();
        const cacheTime = Date.now() - cacheStart;
        
        health.checks.cache = {
          status: 'healthy',
          responseTime: cacheTime
        };

        if (detailed) {
          const cacheStats = await cacheService.getStats();
          health.checks.cache.stats = cacheStats;
        }
      } catch (error) {
        health.checks.cache = {
          status: 'unhealthy',
          error: error.message
        };
      }

      // Memory health
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      health.checks.memory = {
        status: memUsageMB.heapUsed < 500 ? 'healthy' : 'warning',
        usage: memUsageMB
      };

      // Determine overall status
      const hasUnhealthy = Object.values(health.checks).some(check => check.status === 'unhealthy');
      const hasWarning = Object.values(health.checks).some(check => check.status === 'warning');
      
      if (hasUnhealthy) {
        health.status = 'unhealthy';
      } else if (hasWarning) {
        health.status = 'warning';
      }

      // Output health status
      const statusEmoji = health.status === 'healthy' ? '✅' : 
                         health.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${statusEmoji} [${timestamp}] System Health: ${health.status.toUpperCase()}`);
      
      if (detailed || health.status !== 'healthy') {
        console.log('  📊 Details:');
        Object.entries(health.checks).forEach(([service, check]) => {
          const emoji = check.status === 'healthy' ? '✅' : 
                       check.status === 'warning' ? '⚠️' : '❌';
          console.log(`    ${emoji} ${service}: ${check.status}`);
          
          if (check.responseTime) {
            console.log(`       Response time: ${check.responseTime}ms`);
          }
          if (check.connections) {
            console.log(`       Connections: ${check.connections}`);
          }
          if (check.usage) {
            console.log(`       Memory: ${check.usage.heapUsed}MB / ${check.usage.heapTotal}MB`);
          }
          if (check.error) {
            console.log(`       Error: ${check.error}`);
          }
        });
      }

      // Log to file
      scriptLogger.info('Health check completed', health);

    } catch (error) {
      scriptLogger.error('Health check failed', { error: error.message });
      console.log(`❌ [${timestamp}] Health check failed: ${error.message}`);
    }
  }

  /**
   * Check performance metrics
   */
  async checkPerformance(alerts = true) {
    try {
      const metrics = await performanceTracker.getMetrics();
      const timestamp = new Date().toISOString();

      console.log(`📈 [${timestamp}] Performance Metrics:`);
      console.log(`   Total Requests: ${metrics.summary.totalRequests}`);
      console.log(`   Total Errors: ${metrics.summary.totalErrors}`);
      console.log(`   Avg Response Time: ${metrics.summary.avgResponseTime?.toFixed(2)}ms`);
      console.log(`   Error Rate: ${((metrics.summary.totalErrors / Math.max(metrics.summary.totalRequests, 1)) * 100).toFixed(2)}%`);

      // Performance alerts
      if (alerts) {
        if (metrics.summary.avgResponseTime > 1000) {
          console.log('⚠️  ALERT: High average response time detected!');
          scriptLogger.warn('High response time alert', {
            avgResponseTime: metrics.summary.avgResponseTime
          });
        }

        const errorRate = (metrics.summary.totalErrors / Math.max(metrics.summary.totalRequests, 1)) * 100;
        if (errorRate > 5) {
          console.log('⚠️  ALERT: High error rate detected!');
          scriptLogger.warn('High error rate alert', {
            errorRate,
            totalErrors: metrics.summary.totalErrors,
            totalRequests: metrics.summary.totalRequests
          });
        }
      }

      // Top slow endpoints
      const slowEndpoints = Object.entries(metrics.requests || {})
        .filter(([_, data]) => data.avgDuration > 500)
        .sort(([_, a], [__, b]) => b.avgDuration - a.avgDuration)
        .slice(0, 3);

      if (slowEndpoints.length > 0) {
        console.log('   🐌 Slow Endpoints:');
        slowEndpoints.forEach(([endpoint, data]) => {
          console.log(`     ${endpoint}: ${data.avgDuration.toFixed(2)}ms avg (${data.count} requests)`);
        });
      }

    } catch (error) {
      scriptLogger.error('Performance check failed', { error: error.message });
      console.log(`❌ Performance check failed: ${error.message}`);
    }
  }

  /**
   * Check system resources
   */
  async checkResources(alerts = true) {
    try {
      const timestamp = new Date().toISOString();
      
      // Memory usage
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      // CPU usage (if available)
      let cpuUsage = null;
      try {
        const usage = process.cpuUsage();
        cpuUsage = {
          user: Math.round(usage.user / 1000), // Convert to ms
          system: Math.round(usage.system / 1000)
        };
      } catch (error) {
        // CPU usage not available
      }

      console.log(`💻 [${timestamp}] Resource Usage:`);
      console.log(`   Memory: ${memUsageMB.heapUsed}MB / ${memUsageMB.heapTotal}MB (${memUsageMB.rss}MB RSS)`);
      console.log(`   Uptime: ${Math.round(process.uptime())}s`);
      
      if (cpuUsage) {
        console.log(`   CPU: ${cpuUsage.user}ms user, ${cpuUsage.system}ms system`);
      }

      // Resource alerts
      if (alerts) {
        if (memUsageMB.heapUsed > 1000) {
          console.log('⚠️  ALERT: High memory usage detected!');
          scriptLogger.warn('High memory usage alert', { memUsage: memUsageMB });
        }

        const heapUsagePercent = (memUsageMB.heapUsed / memUsageMB.heapTotal) * 100;
        if (heapUsagePercent > 90) {
          console.log('⚠️  ALERT: Heap memory usage critical!');
          scriptLogger.warn('Critical heap usage alert', { 
            heapUsagePercent,
            memUsage: memUsageMB 
          });
        }
      }

    } catch (error) {
      scriptLogger.error('Resource check failed', { error: error.message });
      console.log(`❌ Resource check failed: ${error.message}`);
    }
  }

  /**
   * Run diagnostic checks
   */
  async runDiagnostics() {
    console.log('🔍 Running comprehensive diagnostics...\n');

    try {
      await this.initialize();

      // Health diagnostics
      console.log('=== HEALTH DIAGNOSTICS ===');
      await this.checkHealth(true);
      console.log('');

      // Performance diagnostics
      console.log('=== PERFORMANCE DIAGNOSTICS ===');
      await this.checkPerformance(false);
      console.log('');

      // Resource diagnostics
      console.log('=== RESOURCE DIAGNOSTICS ===');
      await this.checkResources(false);
      console.log('');

      // Cache diagnostics
      console.log('=== CACHE DIAGNOSTICS ===');
      try {
        const cacheStats = await cacheService.getStats();
        console.log(`   Hit Rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
        console.log(`   Total Keys: ${cacheStats.totalKeys}`);
        console.log(`   Memory Usage: ${(cacheStats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      } catch (error) {
        console.log(`   ❌ Cache diagnostics failed: ${error.message}`);
      }
      console.log('');

      // Database diagnostics
      console.log('=== DATABASE DIAGNOSTICS ===');
      try {
        const dbStatus = await dbOptimization.getConnectionStatus();
        console.log(`   Connected: ${dbStatus.connected}`);
        console.log(`   Active Connections: ${dbStatus.connections}`);
        console.log(`   Response Time: ${dbStatus.responseTime}ms`);
      } catch (error) {
        console.log(`   ❌ Database diagnostics failed: ${error.message}`);
      }

      console.log('\n✅ Diagnostics complete');

    } catch (error) {
      scriptLogger.error('Diagnostics failed', { error: error.message });
      console.log(`❌ Diagnostics failed: ${error.message}`);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Cleanup connections
   */
  async cleanup() {
    try {
      await cacheService.close();
      await dbOptimization.closeConnections();
      performanceTracker.stop();
    } catch (error) {
      scriptLogger.warn('Cleanup error', { error: error.message });
    }
  }
}

// Command line interface
async function main() {
  const monitor = new ServiceMonitor();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'start':
        const interval = parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 30000;
        const detailed = args.includes('--detailed');
        const noAlerts = args.includes('--no-alerts');
        
        await monitor.start({
          interval,
          detailed,
          alerts: !noAlerts
        });
        break;

      case 'health':
        await monitor.initialize();
        await monitor.checkHealth(true);
        await monitor.cleanup();
        break;

      case 'performance':
        await monitor.initialize();
        await monitor.checkPerformance(false);
        await monitor.cleanup();
        break;

      case 'resources':
        await monitor.initialize();
        await monitor.checkResources(false);
        await monitor.cleanup();
        break;

      case 'diagnostics':
        await monitor.runDiagnostics();
        break;

      default:
        console.log(`
Post-Service Monitor & Diagnostics Tool

Available commands:
  start [options]     - Start continuous monitoring
    --interval=ms     - Monitoring interval (default: 30000)
    --detailed        - Show detailed information
    --no-alerts       - Disable alerts
  
  health             - Check system health once
  performance        - Check performance metrics once
  resources          - Check resource usage once
  diagnostics        - Run comprehensive diagnostics

Examples:
  npm run monitor:start
  npm run monitor:start -- --interval=10000 --detailed
  npm run monitor:health
  npm run monitor:diagnostics
        `);
        break;
    }
  } catch (error) {
    scriptLogger.error('Monitor command failed', { 
      command, 
      args, 
      error: error.message 
    });
    console.log(`❌ Command failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Received interrupt signal');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received terminate signal');
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ServiceMonitor;
