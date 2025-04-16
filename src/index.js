import express from 'express';
import cors from 'cors';
import axios from 'axios';
import yeetRoute from './route/yeetRoute.js';
import { errorHandler } from './middleware/errorHandler.js';
import verifyJWT from './middleware/verifyJWT.js';
import verifyServiceToken from './middleware/verifyServiceToken.js';
import { createInternalUser } from './controllers/userController.js';

const app = express();

// Health check endpoint
app.get('/health', (req, res) => res.send('OK'));

// Allow requests from frontend/API gateway
app.use(cors({
  origin: ['http://localhost:3000', 'http://api-gateway:80'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token']
}));

// Required for parsing request bodies
app.use(express.json());

// Debug middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});

// Regular routes
app.use('/yeets', verifyJWT, yeetRoute); 

// Internal routes - handle directly with controller functions
app.post('/internal/users', verifyServiceToken, (req, res) => {
  console.log('Received request to /internal/users:', req.body);
  createInternalUser(req, res);
});

// Fallback for other internal routes
app.use('/internal', verifyServiceToken, (req, res) => {
  console.log('Unknown internal route:', req.url);
  res.status(404).json({ error: 'Internal endpoint not found' });
});

// Global error handler
app.use(errorHandler);

const PORT = 3000; // Reverted back to original port
app.listen(PORT, () => {
  console.log(`Yeet Service: ${PORT}`);
});