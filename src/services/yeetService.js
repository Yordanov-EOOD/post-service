
import prisma from '../config/db.js';
import { 
  postCache, 
  userCache, 
  timelineCache, 
  generateCacheKey, 
  cacheHelpers 
} from '../utils/cache.js';
import { 
  queryOptimizations, 
  batchOperations, 
  performanceTracker,
  paginationHelpers 
} from '../utils/dbOptimization.js';
import { postOperations, asyncUtils } from '../utils/parallel.js';


export const createYeetService = async (yeetData) => {
  const queryId = `create_yeet_${Date.now()}`;
  performanceTracker.startTracking(queryId, 'createYeet');
  try {
    // Use optimized query with minimal includes
    const newYeet = await prisma.post.create({
      data: {
        content: yeetData.content,
        image: yeetData.image,
        authorId: yeetData.authUserId,
      },      include: {
        author: {
          select: {
            id: true,
            username: true,
            authUserId: true
          }
        }
      }
    });

    // Cache the new post
    postCache.set(generateCacheKey.post(newYeet.id), newYeet);
    
    // Invalidate related caches
    cacheHelpers.invalidatePostCaches(newYeet.id, newYeet.authorId);
    
    performanceTracker.endTracking(queryId);
    return newYeet;
  } catch (error) {
    performanceTracker.endTracking(queryId);
    throw error;
  }
};

export const getAllYeetsService = async (page = 1, limit = 10) => {
  try {    // Validate and normalize pagination parameters
    const { page: validPage, limit: validLimit } = paginationHelpers.validatePagination(page, limit);
    const cacheKey = generateCacheKey.trendingPosts(validPage, validLimit);
    
    // Try cache first
    const cached = postCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const queryId = `get_all_yeets_${Date.now()}`;
    performanceTracker.startTracking(queryId, 'getAllYeets');
    
    // Calculate skip for pagination
    const skip = (validPage - 1) * validLimit;
      // Parallel execution: get posts and total count
    const [yeets, totalCount] = await Promise.all([
      prisma.post.findMany({
        ...queryOptimizations.getPostWithDetails,
        skip: skip,
        take: validLimit,
        orderBy: {
          publishedAt: 'desc'
        }
      }),
      prisma.post.count()
    ]);

    const result = {
      posts: yeets,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / validLimit),
        hasNextPage: validPage < Math.ceil(totalCount / validLimit),
        hasPreviousPage: validPage > 1
      }
    };

    // Cache the result
    postCache.set(cacheKey, result, 300000); // 5 minutes
    
    performanceTracker.endTracking(queryId);
    return result;  } catch (error) {
    console.error('Error getting all yeets:', error);
    throw error;
  }
};

// Get personalized timeline/feed for a user with parallel processing
export const getUserTimelineService = async (userId, page = 1, limit = 10) => {
  try {
    // Validate pagination parameters
    const { page: validPage, limit: validLimit } = paginationHelpers.validatePagination(page, limit);
    const cacheKey = generateCacheKey.timeline(userId, validPage, validLimit);
    
    // Try cache first
    const cached = timelineCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const queryId = `get_timeline_${Date.now()}`;
    performanceTracker.startTracking(queryId, 'getUserTimeline');
    
    // Use parallel processing for timeline generation
    const timelineResults = await postOperations.generateTimelines(
      prisma, 
      [userId], 
      validPage, 
      validLimit
    );    const result = timelineResults[0] || { userId, posts: [] };
    
    // Add pagination metadata
    const totalPosts = await prisma.post.count({
      where: {
        author: {
          OR: [
            { id: userId },
            { followers: { some: { followerId: userId } } }
          ]
        }
      }
    });

    const finalResult = {
      ...result,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: totalPosts,
        totalPages: Math.ceil(totalPosts / validLimit),
        hasNextPage: validPage < Math.ceil(totalPosts / validLimit),
        hasPreviousPage: validPage > 1
      }
    };

    // Cache the result
    timelineCache.set(cacheKey, finalResult, 300000); // 5 minutes
    
    performanceTracker.endTracking(queryId);
    return finalResult;
  } catch (error) {
    console.error(`Error getting timeline for user ${userId}:`, error);
    throw error;
  }
};

export const getYeetByIdService = async (id) => {
  try {
    // Check cache first
    const cacheKey = generateCacheKey.post(id);
    const cached = postCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const queryId = `get_yeet_${Date.now()}`;
    performanceTracker.startTracking(queryId, 'getYeetById');
      // Query the database with optimized includes
    const yeet = await prisma.post.findUnique({
      where: { id },
      ...queryOptimizations.getPostWithDetails
    });

    if (!yeet) {
      performanceTracker.endTracking(queryId);
      throw new Error('Yeet not found');
    }

    // Cache the result
    postCache.set(cacheKey, yeet);
    
    performanceTracker.endTracking(queryId);
    return yeet;
  } catch (error) {
    console.error(`Error getting yeet by ID ${id}:`, error);
    throw error;
  }
};

export const deleteYeetService = async (id) => {
  const queryId = `delete_yeet_${Date.now()}`;
  performanceTracker.startTracking(queryId, 'deleteYeet');

  try {    // Get the post first to know which author's cache to invalidate
    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true }
    });
    
    if (!post) {
      performanceTracker.endTracking(queryId);
      throw new Error('Yeet not found');
    }
    
    const deletedYeet = await prisma.post.delete({ where: { id } });
    
    // Invalidate related caches
    cacheHelpers.invalidatePostCaches(id, post.authorId);
    
    performanceTracker.endTracking(queryId);
    return deletedYeet;
  } catch (error) {
    performanceTracker.endTracking(queryId);
    throw error;
  }
};

export const likeYeetService = async (yeetId, userId) => {
  const queryId = `like_yeet_${Date.now()}`;
  performanceTracker.startTracking(queryId, 'likeYeet');

  try {
    // Use parallel processing for like operations
    const operations = [{
      type: 'like',
      userId,
      postId: yeetId,
      action: 'add'
    }];

    const result = await postOperations.batchUserInteractions(prisma, operations);
    
    // Get updated post data
    const yeet = await getYeetByIdService(yeetId);
    
    // Invalidate post cache to refresh like count
    postCache.delete(generateCacheKey.post(yeetId));
    postCache.delete(generateCacheKey.postStats(yeetId));
    
    performanceTracker.endTracking(queryId);
    return { success: true, yeet, userId, liked: true };
  } catch (error) {
    performanceTracker.endTracking(queryId);
    // If like already exists, handle gracefully
    if (error.code === 'P2002') {
      const yeet = await getYeetByIdService(yeetId);
      return { success: true, yeet, userId, liked: true, message: 'Already liked' };
    }
    throw error;
  }
};

export const retweetYeetService = async (yeetId, userId) => {
  const queryId = `retweet_yeet_${Date.now()}`;
  performanceTracker.startTracking(queryId, 'retweetYeet');

  try {
    // Use parallel processing for retweet operations
    const operations = [{
      type: 'retweet',
      userId,
      postId: yeetId,
      action: 'add'
    }];

    const result = await postOperations.batchUserInteractions(prisma, operations);
    
    // Get updated post data
    const yeet = await getYeetByIdService(yeetId);
    
    // Invalidate post cache to refresh retweet count
    postCache.delete(generateCacheKey.post(yeetId));
    postCache.delete(generateCacheKey.postStats(yeetId));
    
    performanceTracker.endTracking(queryId);
    return { success: true, yeet, userId, retweeted: true };
  } catch (error) {
    performanceTracker.endTracking(queryId);
    // If retweet already exists, handle gracefully
    if (error.code === 'P2002') {
      const yeet = await getYeetByIdService(yeetId);
      return { success: true, yeet, userId, retweeted: true, message: 'Already retweeted' };
    }
    throw error;
  }
};

// New optimized batch operations for better performance
export const batchGetYeetsService = async (yeetIds, userId = null) => {
  const queryId = `batch_get_yeets_${Date.now()}`;
  performanceTracker.startTracking(queryId, 'batchGetYeets');

  try {
    const result = await postOperations.fetchPostsWithStats(prisma, yeetIds, userId);
    performanceTracker.endTracking(queryId);
    return result;
  } catch (error) {
    performanceTracker.endTracking(queryId);
    throw error;
  }
};