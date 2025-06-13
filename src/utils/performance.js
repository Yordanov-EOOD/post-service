/**
 * Performance monitoring utilities for post-service
 * Provides request tracking, metrics collection, and performance analysis
 */

import { performance as perfHooks } from 'perf_hooks';

// Performance metrics collector
export class PerformanceMonitor {
  constructor() {
    this.requests = new Map();
    this.tracking = new Map(); // For startTracking/endTracking
    this.metrics = {
        requests: {
            total: 0,
            successful: 0,
            failed: 0,
            averageResponseTime: 0,
            responseTimeSum: 0
        },
        endpoints: new Map(),
        errors: new Map(),
        slowRequests: []
    };
    this.slowRequestThreshold = 1000; // 1 second
    this.maxSlowRequests = 100;
}    
    
// Direct record request method (used by middleware)
    recordRequest(method, path, statusCode, duration) {
        const isSuccessful = statusCode >= 200 && statusCode < 400;
        const endpoint = path;
        
        // Update global metrics
        this.metrics.requests.total++;
        this.metrics.requests.responseTimeSum += duration;
        this.metrics.requests.averageResponseTime = Math.round(
            this.metrics.requests.responseTimeSum / this.metrics.requests.total
        );

        if (isSuccessful) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
        }

        // Endpoint-specific metrics
        const endpointKey = `${method} ${endpoint}`;
        if (!this.metrics.endpoints.has(endpointKey)) {
            this.metrics.endpoints.set(endpointKey, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                successCount: 0,
                errorCount: 0,
                maxTime: 0,
                minTime: Infinity
            });
        }

        const endpointMetrics = this.metrics.endpoints.get(endpointKey);
        endpointMetrics.count++;
        endpointMetrics.totalTime += duration;
        endpointMetrics.averageTime = Math.round(endpointMetrics.totalTime / endpointMetrics.count);
        endpointMetrics.maxTime = Math.max(endpointMetrics.maxTime, duration);
        endpointMetrics.minTime = Math.min(endpointMetrics.minTime, duration);

        if (isSuccessful) {
            endpointMetrics.successCount++;
        } else {
            endpointMetrics.errorCount++;
        }

        // Track slow requests
        if (duration > this.slowRequestThreshold) {
            this.trackSlowRequest({
                method,
                endpoint,
                duration,
                statusCode,
                isSuccessful
            });
        }

        return {
            method,
            path,
            statusCode,
            duration,
            isSuccessful
        };
    }

    // Start tracking a request
    startRequest(requestId, endpoint, method, userAgent = null) {
        const startTime = perfHooks.now();
        this.requests.set(requestId, {
            requestId,
            endpoint,
            method,
            userAgent,
            startTime,
            timestamp: new Date().toISOString()
        });

        return requestId;
    }

    // End tracking a request
    endRequest(requestId, statusCode, error = null) {
        const request = this.requests.get(requestId);
        if (!request) return null;        const endTime = perfHooks.now();
        const duration = Math.round(endTime - request.startTime);
        
        const requestData = {
            ...request,
            endTime,
            duration,
            statusCode,
            error: error ? error.message : null,
            isSuccessful: statusCode >= 200 && statusCode < 400
        };

        // Update global metrics
        this.updateMetrics(requestData);

        // Track slow requests
        if (duration > this.slowRequestThreshold) {
            this.trackSlowRequest(requestData);
        }

        // Clean up
        this.requests.delete(requestId);
        
        return requestData;
    }    // Start tracking an operation (for controllers)
    startTracking(operation, metadata = {}) {
        const trackingId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = perfHooks.now();
        
        this.tracking.set(trackingId, {
            operation,
            metadata,
            startTime,
            timestamp: new Date().toISOString()
        });
        
        return trackingId;
    }    // End tracking an operation
    endTracking(trackingId) {
        const track = this.tracking.get(trackingId);
        if (!track) return null;

        const endTime = perfHooks.now();
        const duration = Math.round(endTime - track.startTime);
        
        const result = {
            ...track,
            endTime,
            duration,
            endTimestamp: new Date().toISOString()
        };

        this.tracking.delete(trackingId);
        return result;
    }

    // Record an error (for controllers)
    recordError(operation, error, metadata = {}) {
        const errorKey = `${operation}_error`;
        const errorCount = this.metrics.errors.get(errorKey) || 0;
        this.metrics.errors.set(errorKey, errorCount + 1);
        
        // Also track as general error
        const generalErrorKey = error instanceof Error ? error.name : 'UnknownError';
        const generalCount = this.metrics.errors.get(generalErrorKey) || 0;
        this.metrics.errors.set(generalErrorKey, generalCount + 1);

        return {
            operation,
            error: error instanceof Error ? error.message : error,
            metadata,
            timestamp: new Date().toISOString()
        };
    }

    // Update performance metrics
    updateMetrics(requestData) {
        const { endpoint, method, duration, isSuccessful, error } = requestData;
        
        // Global request metrics
        this.metrics.requests.total++;
        this.metrics.requests.responseTimeSum += duration;
        this.metrics.requests.averageResponseTime = Math.round(
            this.metrics.requests.responseTimeSum / this.metrics.requests.total
        );

        if (isSuccessful) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
        }

        // Endpoint-specific metrics
        const endpointKey = `${method} ${endpoint}`;
        if (!this.metrics.endpoints.has(endpointKey)) {
            this.metrics.endpoints.set(endpointKey, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                successCount: 0,
                errorCount: 0,
                maxTime: 0,
                minTime: Infinity
            });
        }

        const endpointMetrics = this.metrics.endpoints.get(endpointKey);
        endpointMetrics.count++;
        endpointMetrics.totalTime += duration;
        endpointMetrics.averageTime = Math.round(endpointMetrics.totalTime / endpointMetrics.count);
        endpointMetrics.maxTime = Math.max(endpointMetrics.maxTime, duration);
        endpointMetrics.minTime = Math.min(endpointMetrics.minTime, duration);

        if (isSuccessful) {
            endpointMetrics.successCount++;
        } else {
            endpointMetrics.errorCount++;
        }

        // Error tracking
        if (error) {
            const errorKey = error.split('\n')[0]; // First line of error
            const errorCount = this.metrics.errors.get(errorKey) || 0;
            this.metrics.errors.set(errorKey, errorCount + 1);
        }
    }

    // Track slow requests
    trackSlowRequest(requestData) {
        this.metrics.slowRequests.push({
            ...requestData,
            timestamp: new Date().toISOString()
        });

        // Keep only recent slow requests
        if (this.metrics.slowRequests.length > this.maxSlowRequests) {
            this.metrics.slowRequests.shift();
        }
    }

    // Get performance statistics
    getStats() {
        const { requests, endpoints, errors, slowRequests } = this.metrics;
        
        // Convert endpoints Map to object for JSON serialization
        const endpointStats = {};
        for (const [endpoint, stats] of endpoints.entries()) {
            endpointStats[endpoint] = {
                ...stats,
                successRate: stats.count > 0 ? 
                    ((stats.successCount / stats.count) * 100).toFixed(2) + '%' : '0%'
            };
        }

        // Convert errors Map to object
        const errorStats = {};
        for (const [error, count] of errors.entries()) {
            errorStats[error] = count;
        }

        return {
            requests: {
                ...requests,
                successRate: requests.total > 0 ? 
                    ((requests.successful / requests.total) * 100).toFixed(2) + '%' : '0%',
                errorRate: requests.total > 0 ? 
                    ((requests.failed / requests.total) * 100).toFixed(2) + '%' : '0%'
            },
            endpoints: endpointStats,
            errors: errorStats,
            slowRequests: {
                count: slowRequests.length,
                threshold: this.slowRequestThreshold + 'ms',
                recent: slowRequests.slice(-10)
            },
            activeRequests: this.requests.size,
            timestamp: new Date().toISOString()
        };
    }

    // Get real-time metrics
    getRealTimeMetrics() {
        const stats = this.getStats();
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const fiveMinutesAgo = now - 300000;

        // Recent requests (last minute)
        const recentSlowRequests = this.metrics.slowRequests.filter(req => 
            new Date(req.timestamp).getTime() > oneMinuteAgo
        );

        const last5MinSlowRequests = this.metrics.slowRequests.filter(req =>
            new Date(req.timestamp).getTime() > fiveMinutesAgo
        );

        return {
            ...stats,
            realTime: {
                slowRequestsLastMinute: recentSlowRequests.length,
                slowRequestsLast5Minutes: last5MinSlowRequests.length,
                currentLoad: this.requests.size,
                timestamp: new Date().toISOString()
            }
        };
    }

    // Reset all metrics
    reset() {
        this.requests.clear();
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                averageResponseTime: 0,
                responseTimeSum: 0
            },
            endpoints: new Map(),
            errors: new Map(),
            slowRequests: []
        };
    }

    // Export metrics for external monitoring
    exportMetrics() {
        const stats = this.getStats();
        return {
            service: 'post-service',
            timestamp: new Date().toISOString(),
            metrics: stats,
            health: this.getHealthStatus()
        };
    }

    // Get health status based on metrics
    getHealthStatus() {
        const { requests } = this.metrics;
        const errorRate = requests.total > 0 ? (requests.failed / requests.total) : 0;
        const avgResponseTime = requests.averageResponseTime;
        const activeRequests = this.requests.size;

        let status = 'healthy';
        const issues = [];

        if (errorRate > 0.1) { // More than 10% error rate
            status = 'unhealthy';
            issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
        }

        if (avgResponseTime > 2000) { // More than 2 seconds average
            status = status === 'healthy' ? 'degraded' : 'unhealthy';
            issues.push(`Slow response time: ${avgResponseTime}ms`);
        }

        if (activeRequests > 100) { // More than 100 concurrent requests
            status = status === 'healthy' ? 'degraded' : 'unhealthy';
            issues.push(`High concurrent load: ${activeRequests} requests`);
        }

        return {
            status,
            issues,
            metrics: {
                errorRate: `${(errorRate * 100).toFixed(2)}%`,
                averageResponseTime: `${avgResponseTime}ms`,
                activeRequests
            }
        };
    }
}

// Memory and resource monitoring
export class ResourceMonitor {
    constructor() {
        this.startTime = Date.now();
        this.samples = [];
        this.maxSamples = 100;
    }

    // Get current resource usage
    getCurrentUsage() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024), // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                external: Math.round(memUsage.external / 1024 / 1024), // MB
                arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: Math.round((Date.now() - this.startTime) / 1000), // seconds
            timestamp: new Date().toISOString()
        };
    }

    // Sample resource usage
    sample() {
        const usage = this.getCurrentUsage();
        this.samples.push(usage);

        // Keep only recent samples
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }

        return usage;
    }

    // Get resource statistics
    getStats() {
        if (this.samples.length === 0) {
            return this.getCurrentUsage();
        }

        const memoryStats = {
            current: this.samples[this.samples.length - 1].memory,
            average: {},
            peak: {}
        };

        // Calculate averages and peaks
    const memoryKeys = Object.keys(memoryStats.current);
    memoryKeys.forEach(key => {
        const values = this.samples.map(s => s.memory[key]);
        memoryStats.average[key] = Math.round(
            values.reduce((sum, val) => sum + val, 0) / values.length
        );
        memoryStats.peak[key] = Math.max(...values);
    });

    return {
      ...this.getCurrentUsage(),
      statistics: {
      memory: memoryStats,
      sampleCount: this.samples.length,
      monitoringDuration: Math.round((Date.now() - this.startTime) / 1000)
      }
    };
  }
}

// Create global monitor instances
export const performanceMonitor = new PerformanceMonitor();
export const resourceMonitor = new ResourceMonitor();

// Middleware for automatic request tracking
export const createPerformanceMiddleware = () => {
  return (req, res, next) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const endpoint = req.route ? req.route.path : req.path;
    const userAgent = req.get('User-Agent');

    // Start tracking
    performanceMonitor.startRequest(requestId, endpoint, req.method, userAgent);

    // Store request ID for later use
    req.performanceId = requestId;

    // Override res.end to capture completion
    const originalEnd = res.end;
    res.end = function(...args) {
      // End tracking
      performanceMonitor.endRequest(requestId, res.statusCode);
            
      // Call original end
      originalEnd.apply(this, args);
    };

    next();
  };
};

// Start resource monitoring with intervals
export const startResourceMonitoring = (intervalMs = 30000) => {
  const interval = setInterval(() => {
    resourceMonitor.sample();
  }, intervalMs);

  // Cleanup function
  return () => clearInterval(interval);
};

// Named export for compatibility with index.js
export const performance = {
  PerformanceMonitor,
  ResourceMonitor,
  performanceMonitor,
  resourceMonitor,
  createPerformanceMiddleware,
  startResourceMonitoring,
  recordRequest: (method, path, statusCode, duration) => performanceMonitor.recordRequest(method, path, statusCode, duration),
  getMetrics: () => performanceMonitor.getMetrics(),
  getDetailedStats: () => performanceMonitor.getDetailedStats(),
  start: () => performanceMonitor.start(),
  stop: () => performanceMonitor.stop()
};

export default {
  PerformanceMonitor,
  ResourceMonitor,
  performanceMonitor,
  resourceMonitor,
  createPerformanceMiddleware,
  startResourceMonitoring,
  recordRequest: (method, path, statusCode, duration) => performanceMonitor.recordRequest(method, path, statusCode, duration),
  getMetrics: () => performanceMonitor.getMetrics(),
  getDetailedStats: () => performanceMonitor.getDetailedStats(),
  start: () => performanceMonitor.start(),
  stop: () => performanceMonitor.stop()
};
