/**
 * Database optimization utilities for post-service
 * Provides query optimization, connection pooling, and performance monitoring
 */

// Optimized query helpers
export const queryOptimizations = {    // Optimized post queries with strategic includes
    getPostWithDetails: {
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    authUserId: true
                }
            }
        }
    },    // Optimized timeline query
    getTimelinePosts: (userId, page = 1, limit = 10) => ({
        where: {
            OR: [
                { authorId: userId },
                {
                    author: {
                        followers: {
                            some: { followerId: userId }
                        }
                    }
                }
            ]
        },
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    authUserId: true
                }
            }
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
    }),    // Optimized user posts query
    getUserPosts: (userId, currentUserId, page = 1, limit = 10) => ({
        where: { authorId: userId },
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    authUserId: true
                }
            }
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
    })
};

// Batch operation utilities
export const batchOperations = {
    // Batch fetch posts with user interaction status
    async getBatchPostsWithInteractions(prisma, postIds, userId = null) {
        const posts = await prisma.yeet.findMany({
            where: { id: { in: postIds } },
            ...queryOptimizations.getPostWithDetails
        });

        if (!userId) return posts;

        // Batch fetch user interactions
        const [likes, retweets] = await Promise.all([
            prisma.like.findMany({
                where: {
                    postId: { in: postIds },
                    userId
                },
                select: { postId: true }
            }),
            prisma.retweet.findMany({
                where: {
                    postId: { in: postIds },
                    userId
                },
                select: { postId: true }
            })
        ]);

        const likedPosts = new Set(likes.map(l => l.postId));
        const retweetedPosts = new Set(retweets.map(r => r.postId));

        return posts.map(post => ({
            ...post,
            isLiked: likedPosts.has(post.id),
            isRetweeted: retweetedPosts.has(post.id)
        }));
    },

    // Batch update post statistics
    async updatePostStatistics(prisma, postIds) {
        const results = await Promise.all(
            postIds.map(async postId => {
                const [likesCount, retweetsCount, repliesCount] = await Promise.all([
                    prisma.like.count({ where: { postId } }),
                    prisma.retweet.count({ where: { postId } }),
                    prisma.yeet.count({ where: { parentId: postId } })
                ]);

                return {
                    postId,
                    likesCount,
                    retweetsCount,
                    repliesCount
                };
            })
        );

        return results;
    }
};

// Connection pool monitoring
export const connectionMonitor = {
    async getConnectionInfo(prisma) {
        try {
            // Note: Prisma doesn't expose direct connection pool info
            // But we can monitor query performance
            const startTime = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            const responseTime = Date.now() - startTime;

            return {
                status: 'connected',
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    },

    async getDatabaseStats(prisma) {
        try {
            const [
                postsCount,
                usersCount,
                likesCount,
                retweetsCount
            ] = await Promise.all([
                prisma.yeet.count(),
                prisma.$queryRaw`SELECT COUNT(DISTINCT "authorId") as count FROM "Yeet"`,
                prisma.like.count(),
                prisma.retweet.count()
            ]);

            return {
                posts: postsCount,
                activeUsers: Number(usersCount[0]?.count || 0),
                likes: likesCount,
                retweets: retweetsCount,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to get database stats:', error);
            return null;
        }
    }
};

// Query performance tracking
export class QueryPerformanceTracker {
    constructor() {
        this.queries = new Map();
        this.slowQueries = [];
        this.slowQueryThreshold = 1000; // 1 second
    }

    startTracking(queryId, operation) {
        this.queries.set(queryId, {
            operation,
            startTime: Date.now(),
            timestamp: new Date().toISOString()
        });
    }

    endTracking(queryId) {
        const query = this.queries.get(queryId);
        if (!query) return null;

        const duration = Date.now() - query.startTime;
        const result = {
            ...query,
            duration,
            endTime: Date.now()
        };

        // Track slow queries
        if (duration > this.slowQueryThreshold) {
            this.slowQueries.push(result);
            // Keep only last 50 slow queries
            if (this.slowQueries.length > 50) {
                this.slowQueries.shift();
            }
        }

        this.queries.delete(queryId);
        return result;
    }

    getStats() {
        return {
            activeQueries: this.queries.size,
            slowQueries: this.slowQueries.length,
            recentSlowQueries: this.slowQueries.slice(-10),
            averageSlowQueryTime: this.slowQueries.length > 0 
                ? Math.round(this.slowQueries.reduce((sum, q) => sum + q.duration, 0) / this.slowQueries.length)
                : 0
        };
    }

    clearStats() {
        this.queries.clear();
        this.slowQueries = [];
    }
}

// Create global performance tracker instance
export const performanceTracker = new QueryPerformanceTracker();

// Database middleware for performance tracking
export const withPerformanceTracking = (operation) => {
    return async (prisma, ...args) => {
        const queryId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        performanceTracker.startTracking(queryId, operation);
        
        try {
            const result = await prisma[operation](...args);
            performanceTracker.endTracking(queryId);
            return result;
        } catch (error) {
            performanceTracker.endTracking(queryId);
            throw error;
        }
    };
};

// Pagination helpers
export const paginationHelpers = {
    validatePagination: (page, limit) => {
        const validPage = Math.max(1, parseInt(page) || 1);
        const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
        return { page: validPage, limit: validLimit };
    },

    createPaginationMeta: (page, limit, total) => {
        const totalPages = Math.ceil(total / limit);
        return {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        };
    }
};

// Export individual components
export const dbOptimization = {
    queryOptimizations,
    batchOperations,
    connectionMonitor,
    QueryPerformanceTracker,
    performanceTracker,
    withPerformanceTracking,
    paginationHelpers,
    // Add methods that index.js expects
    getConnectionStatus: async () => {
        // For testing and health checks, return a mock status
        // In production, this would connect to the actual database
        try {
            // Import prisma here to avoid circular dependencies
            const { default: prisma } = await import('../config/db.js');
            return await connectionMonitor.getConnectionInfo(prisma);
        } catch (error) {
            return {
                connected: false,
                connections: 0,
                responseTime: null,
                error: error.message
            };
        }
    },
    closeConnections: async () => {
        try {
            const { default: prisma } = await import('../config/db.js');
            await prisma.$disconnect();
            return Promise.resolve();
        } catch (error) {
            console.error('Error closing database connections:', error);
            return Promise.resolve();
        }
    },
    initialize: async () => {
        try {
            const { default: prisma } = await import('../config/db.js');
            await prisma.$connect();
            return Promise.resolve();
        } catch (error) {
            console.error('Error initializing database:', error);
            return Promise.resolve();
        }
    }
};

export default {
    queryOptimizations,
    batchOperations,
    connectionMonitor,
    QueryPerformanceTracker,
    performanceTracker,
    withPerformanceTracking,
    paginationHelpers
};
