import promClient from 'prom-client';

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'post-service'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const postOperationsTotal = new promClient.Counter({
  name: 'post_operations_total',
  help: 'Total number of post operations',
  labelNames: ['operation', 'status']
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const dbConnections = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

const cacheOperations = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'hit_miss']
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(postOperationsTotal);
register.registerMetric(activeConnections);
register.registerMetric(dbConnections);
register.registerMetric(cacheOperations);

// Middleware to track HTTP requests
export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
};

// Function to track post operations
export const trackPostOperation = (operation, status) => {
  postOperationsTotal.labels(operation, status).inc();
};

// Function to track cache operations
export const trackCacheOperation = (operation, hitMiss) => {
  cacheOperations.labels(operation, hitMiss).inc();
};

// Function to set active connections
export const setActiveConnections = (count) => {
  activeConnections.set(count);
};

// Function to set database connections
export const setDbConnections = (count) => {
  dbConnections.set(count);
};

// Metrics endpoint handler
export const metricsHandler = (req, res) => {
  res.set('Content-Type', register.contentType);
  register.metrics().then(data => {
    res.send(data);
  }).catch(err => {
    res.status(500).send(err);
  });
};

export { register };
