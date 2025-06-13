import {
  createYeetService,
  getAllYeetsService,
  getYeetByIdService,
  deleteYeetService,
  likeYeetService,
  retweetYeetService,
  getUserTimelineService,
  batchGetYeetsService
} from '../services/yeetService.js';
import { getYeetServiceProducer, TOPICS } from '/app/shared/kafka.js';
import logger from '../config/logger.js';
import { performanceMonitor } from '../utils/performance.js';
import { v4 as uuidv4 } from 'uuid';

export const createYeet = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId, userId: req.user?.userId });
  
  const { content, image } = req.body;
  const { userId } = req.user;

  const startTime = Date.now();
  
  try {
    contextLogger.info('Creating yeet', { 
      contentLength: content?.length,
      hasImage: !!image,
      userId    });    // Track performance
    const perfTrackingId = performanceMonitor.startTracking('createYeet', {
      userId,
      hasImage: !!image,
      contentLength: content?.length
    });

    // Create the yeet in the database
    const yeet = await createYeetService({ 
      content, 
      image, 
      authUserId: userId,
      context: { requestId, correlationId }
    });
    
    // Publish the event to Kafka
    try {
      const producer = await getYeetServiceProducer();
      await producer.publishMessage(
        TOPICS.YEET_CREATED, 
        {
          yeetId: yeet.id,
          content: yeet.content,
          authorId: yeet.authorId,
          image: yeet.image,
          timestamp: new Date().toISOString(),
          requestId,
          correlationId
        },
        // Use author ID as the key to ensure all events from the same user go to the same partition
        // This maintains order for the same user's events
        yeet.authorId
      );
      contextLogger.info('Yeet created event published to Kafka', { yeetId: yeet.id });
    } catch (kafkaError) {
      // Don't fail the request if Kafka publishing fails - log and continue
      contextLogger.error('Failed to publish yeet created event', { 
        error: kafkaError.message,
        yeetId: yeet.id
      });
    }    // Complete performance tracking
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackingId);
    
    contextLogger.info('Yeet created successfully', { 
      yeetId: yeet.id,
      duration
    });
    
    res.json({
      ...yeet,
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error creating yeet', { 
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performanceMonitor.recordError('createYeet', error, { userId });
    
    res.status(500).json({ 
      error: error.message || 'Server error',
      requestId,
      correlationId
    });
  }
};

export const getAllYeets = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId });
  
  const startTime = Date.now();
  
  try {
    // Extract pagination parameters from query string
    const { page = 1, limit = 10 } = req.query;
    
    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10))); // Max 50 items per page
    
    contextLogger.info('Fetching yeets with pagination', { 
      page: pageNum, 
      limit: limitNum 
    });    // Track performance
    const perfTrackerId = performanceMonitor.startTracking('getAllYeets', {
      page: pageNum,
      limit: limitNum
    });
    
    const yeets = await getAllYeetsService(pageNum, limitNum, {
      context: { requestId, correlationId }
    });
    
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackerId);
    
    contextLogger.info('Yeets fetched successfully', { 
      resultCount: yeets.data?.length || 0,
      totalCount: yeets.total,
      duration
    });
    
    res.json({
      ...yeets,
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString(),
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error fetching yeets', { 
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performanceMonitor.recordError('getAllYeets', error);
    
    res.status(500).json({ 
      error: 'Server error',
      requestId,
      correlationId
    });
  }
};

/**
 * Batch get yeets by IDs
 */
export const batchGetYeets = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId });
  
  const startTime = Date.now();
  
  try {
    const { yeetIds } = req.body;
    
    if (!Array.isArray(yeetIds) || yeetIds.length === 0) {
      return res.status(400).json({ 
        error: 'yeetIds must be a non-empty array',
        requestId,
        correlationId
      });
    }
    
    if (yeetIds.length > 100) {
      return res.status(400).json({ 
        error: 'Maximum 100 yeets can be fetched at once',
        requestId,
        correlationId
      });
    }
    
    contextLogger.info('Batch fetching yeets', { 
      yeetIds: yeetIds.length 
    });
      // Track performance
    const perfTrackingId = performanceMonitor.startTracking('batchGetYeets', {
      count: yeetIds.length
    });
    
    const yeets = await batchGetYeetsService(yeetIds, {
      context: { requestId, correlationId }
    });
    
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackingId);
    
    contextLogger.info('Batch yeets fetched successfully', { 
      resultCount: yeets.length,
      requestedCount: yeetIds.length,
      duration
    });
    
    res.json({
      yeets,
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString(),
        requested: yeetIds.length,
        found: yeets.length
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error batch fetching yeets', { 
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performanceMonitor.recordError('batchGetYeets', error);
    
    res.status(500).json({ 
      error: 'Server error',
      requestId,
      correlationId
    });
  }
};

// Update getYeetById method
export const getYeetById = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId });
  
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    
    contextLogger.info('Fetching yeet by ID', { yeetId: id });
      // Track performance
    const perfTrackingId = performanceMonitor.startTracking('getYeetById', { yeetId: id });
    
    const yeet = await getYeetByIdService(id, {
      context: { requestId, correlationId }
    });
    
    if (!yeet) {
      const duration = Date.now() - startTime;
      contextLogger.warn('Yeet not found', { yeetId: id, duration });
      return res.status(404).json({ 
        error: 'Yeet not found',
        requestId,
        correlationId
      });
    }
    
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackingId);
    
    contextLogger.info('Yeet fetched successfully', { 
      yeetId: id,
      duration
    });
    
    res.json({
      ...yeet,
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error fetching yeet by ID', { 
      yeetId: req.params.id,
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performanceMonitor.recordError('getYeetById', error, { yeetId: req.params.id });
    
    res.status(500).json({ 
      error: 'Server error',
      requestId,
      correlationId
    });
  }
};

// Update deleteYeet method
export const deleteYeet = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId, userId: req.user?.userId });
  
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const { userId } = req.user;
    
    contextLogger.info('Deleting yeet', { yeetId: id, userId });
      // Track performance
    const perfTrackingId = performanceMonitor.startTracking('deleteYeet', { yeetId: id, userId });
    
    const result = await deleteYeetService(id, userId, {
      context: { requestId, correlationId }
    });
    
    if (!result.success) {
      const duration = Date.now() - startTime;
      contextLogger.warn('Failed to delete yeet', { 
        yeetId: id, 
        userId,
        reason: result.message,
        duration 
      });
      
      return res.status(result.statusCode || 404).json({ 
        error: result.message || 'Yeet not found or unauthorized',
        requestId,
        correlationId
      });
    }
    
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackingId);
    
    contextLogger.info('Yeet deleted successfully', { 
      yeetId: id,
      userId,
      duration
    });
    
    res.json({ 
      message: 'Yeet deleted successfully',
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error deleting yeet', { 
      yeetId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performanceMonitor.recordError('deleteYeet', error, { 
      yeetId: req.params.id, 
      userId: req.user?.userId 
    });
    
    res.status(500).json({ 
      error: 'Server error',
      requestId,
      correlationId
    });
  }
};

// Update likeYeet method
export const likeYeet = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId, userId: req.user?.userId });
  
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const { userId } = req.user;
    
    contextLogger.info('Liking yeet', { yeetId: id, userId });
      // Track performance
    const perfTrackingId = performanceMonitor.startTracking('likeYeet', { yeetId: id, userId });
    
    const result = await likeYeetService(id, userId, {
      context: { requestId, correlationId }
    });
    
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackingId);
    
    contextLogger.info('Yeet like action completed', { 
      yeetId: id,
      userId,
      action: result.action,
      likesCount: result.likesCount,
      duration
    });
    
    res.json({
      ...result,
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error liking yeet', { 
      yeetId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performance.recordError('likeYeet', error, { 
      yeetId: req.params.id, 
      userId: req.user?.userId 
    });
    
    res.status(500).json({ 
      error: 'Server error',
      requestId,
      correlationId
    });
  }
};

// Update retweetYeet method
export const retweetYeet = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId, userId: req.user?.userId });
  
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const { userId } = req.user;
    
    contextLogger.info('Retweeting yeet', { yeetId: id, userId });
    
    // Track performance
    const perfTrackingId = performanceMonitor.startTracking('retweetYeet', { yeetId: id, userId });
    
    const result = await retweetYeetService(id, userId, {
      context: { requestId, correlationId }
    });
    
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackingId);
    
    contextLogger.info('Yeet retweet action completed', { 
      yeetId: id,
      userId,
      action: result.action,
      retweetsCount: result.retweetsCount,
      duration
    });
    
    res.json({
      ...result,
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error retweeting yeet', { 
      yeetId: req.params.id,
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performance.recordError('retweetYeet', error, { 
      yeetId: req.params.id, 
      userId: req.user?.userId 
    });
    
    res.status(500).json({ 
      error: 'Server error',
      requestId,
      correlationId
    });
  }
};

// Update getUserTimeline method
export const getUserTimeline = async (req, res) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const contextLogger = logger.child({ requestId, correlationId, userId: req.user?.userId });
  
  const startTime = Date.now();
  
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;
    
    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10))); // Max 50 items per page
    
    contextLogger.info('Fetching user timeline', { 
      userId,
      page: pageNum, 
      limit: limitNum 
    });
      // Track performance
    const perfTrackingId = performanceMonitor.startTracking('getUserTimeline', {
      userId,
      page: pageNum,
      limit: limitNum
    });
    
    const timeline = await getUserTimelineService(userId, pageNum, limitNum, {
      context: { requestId, correlationId }
    });
    
    const duration = Date.now() - startTime;
    performanceMonitor.endTracking(perfTrackingId);
    
    contextLogger.info('User timeline fetched successfully', { 
      userId,
      resultCount: timeline.data?.length || 0,
      totalCount: timeline.total,
      duration
    });
    
    res.json({
      ...timeline,
      metadata: {
        requestId,
        correlationId,
        processedAt: new Date().toISOString(),
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    contextLogger.error('Error fetching user timeline', { 
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
      duration
    });
    
    performanceMonitor.recordError('getUserTimeline', error, { userId: req.user?.userId });
    
    res.status(500).json({ 
      error: 'Server error',
      requestId,
      correlationId
    });
  }
};