// Simple test application module for integration tests
import express from 'express';
import cors from 'cors';

// Set basic environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';
process.env.SERVICE_TOKEN_SECRET = 'testservicetoken';

// Create test versions of middleware
const testVerifyJWT = (req, res, next) => {
  // Set mock user data for authorized requests
  req.user = {
    userId: 'test-user-id',
    username: 'testuser'
  };
  next();
};

const testVerifyServiceToken = (req, res, next) => {
  // Always authorize service token in tests
  next();
};

// Simple error handler
const testErrorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
};

// Create a test application instance without starting the server
export function createTestApp() {
  const app = express();

  // Basic middleware setup
  app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token']
  }));

  app.use(express.json());

  // Enhanced health check endpoint that matches the main app
  app.get('/health', async (req, res) => {
    const healthCheck = {
      service: 'post-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: 'test',
      checks: {
        database: {
          status: 'healthy',
          connections: 5,
          responseTime: 10
        },
        cache: {
          status: 'healthy'
        },
        memory: {
          status: 'healthy',
          usage: {
            rss: 50,
            heapTotal: 30,
            heapUsed: 20,
            external: 5
          }
        }
      },
      responseTime: 5
    };

    res.status(200).json(healthCheck);
  });
  // Simple yeets routes for testing (order matters - specific routes before parameterized ones)
  app.get('/yeets/timeline', testVerifyJWT, (req, res) => {
    res.json([
      {
        id: 'timeline-yeet-1',
        content: 'Timeline yeet content',
        authorId: 'test-user-id',
        createdAt: new Date().toISOString()
      },
      {
        id: 'timeline-yeet-2',
        content: 'Another timeline yeet',
        authorId: 'test-user-id-2',
        createdAt: new Date().toISOString()
      }
    ]);
  });

  app.get('/yeets', testVerifyJWT, (req, res) => {
    res.json([
      {
        id: 'test-yeet-1',
        content: 'Test yeet content',
        authorId: 'test-user-id',
        createdAt: new Date().toISOString()
      }
    ]);
  });

  app.post('/yeets', testVerifyJWT, (req, res) => {
    const newYeet = {
      id: 'new-test-yeet',
      content: req.body.content,
      authorId: req.user.userId,
      createdAt: new Date().toISOString()
    };
    res.status(201).json(newYeet);
  });

  app.get('/yeets/:id', testVerifyJWT, (req, res) => {
    const yeet = {
      id: req.params.id,
      content: 'Test yeet content',
      authorId: 'test-user-id',
      createdAt: new Date().toISOString()
    };
    res.json(yeet);
  });

  app.delete('/yeets/:id', testVerifyJWT, (req, res) => {
    res.json({
      success: true,
      message: 'Yeet deleted successfully'
    });
  });

  app.post('/yeets/:id/like', testVerifyJWT, (req, res) => {
    res.json({
      success: true,
      message: 'Yeet liked successfully'
    });
  });

  app.post('/yeets/:id/retweet', testVerifyJWT, (req, res) => {
    res.json({
      success: true,
      message: 'Yeet retweeted successfully'
    });
  });
  // Internal routes
  app.post('/internal/users', testVerifyServiceToken, (req, res) => {
    // Validate required fields
    const { username, authUserId } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (!authUserId) {
      return res.status(400).json({ error: 'AuthUserId is required' });
    }
    
    const newUser = {
      id: 'new-test-user',
      username: username,
      authUserId: authUserId,
      createdAt: new Date().toISOString()
    };
    res.status(201).json(newUser);
  });

  // Catch-all for unhandled routes
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      service: 'post-service'
    });
  });

  app.use(testErrorHandler);

  return app;
}
