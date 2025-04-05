import express from 'express';
import cors from 'cors';
import axios from 'axios';
import yeetRoute from './route/yeetRoute.js';
import { errorHandler } from './middleware/errorHandler.js';
import verifyJWT from './middleware/verifyJWT.js';

const app = express();

// Allow requests from frontend/API gateway
app.use(cors({
  origin: ['http://localhost:3000', 'http://api-gateway:80'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Axios client for User Service communication
export const userServiceClient = axios.create({
  baseURL: process.env.USER_SERVICE_URL || 'http://user-service:3000',
  timeout: 5000
});

app.use(express.json());
app.use('/yeets', verifyJWT, yeetRoute); // All yeet routes require JWT
app.use(errorHandler);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Yeet Service: ${PORT}`);
});