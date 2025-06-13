/**
 * Parallel processing utilities for post-service
 * Provides concurrent operations, batch processing, and async optimization
 */

// Promise-based parallel execution utilities
export class ParallelProcessor {
    constructor(maxConcurrency = 10) {
        this.maxConcurrency = maxConcurrency;
        this.stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0
        };
    }

    // Execute functions in parallel with concurrency limit
    async executeParallel(tasks, concurrency = null) {
        const actualConcurrency = concurrency || this.maxConcurrency;
        const results = [];
        const startTime = Date.now();

        // Process tasks in batches
        for (let i = 0; i < tasks.length; i += actualConcurrency) {
            const batch = tasks.slice(i, i + actualConcurrency);
            const batchPromises = batch.map(async (task, index) => {
                const taskStartTime = Date.now();
                try {
                    const result = await (typeof task === 'function' ? task() : task);
                    this.stats.successful++;
                    return { success: true, result, index: i + index };
                } catch (error) {
                    this.stats.failed++;
                    return { success: false, error, index: i + index };
                } finally {
                    const taskExecutionTime = Date.now() - taskStartTime;
                    this.stats.totalExecutionTime += taskExecutionTime;
                    this.stats.totalProcessed++;
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults.map(r => r.value || r.reason));
        }

        // Update statistics
        const totalTime = Date.now() - startTime;
        this.stats.averageExecutionTime = this.stats.totalProcessed > 0 
            ? Math.round(this.stats.totalExecutionTime / this.stats.totalProcessed)
            : 0;

        return {
            results,
            stats: {
                ...this.stats,
                totalExecutionTime: totalTime,
                successRate: this.stats.totalProcessed > 0 
                    ? ((this.stats.successful / this.stats.totalProcessed) * 100).toFixed(2) + '%'
                    : '0%'
            }
        };
    }

    // Reset statistics
    resetStats() {
        this.stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0
        };
    }
}

// Parallel operations for post-related queries
export const postOperations = {
    // Fetch multiple posts with their interaction counts in parallel
    async fetchPostsWithStats(prisma, postIds, userId = null) {
        const processor = new ParallelProcessor(5);
        
        const tasks = postIds.map(postId => async () => {            const [post, likesCount, retweetsCount, repliesCount, userInteractions] = await Promise.all([
                prisma.post.findUnique({
                    where: { id: postId },
                    include: {
                        author: {
                            select: {
                                id: true,
                                username: true,
                            }
                        }
                    }
                }),
                prisma.like.count({ where: { postId } }),
                prisma.retweet.count({ where: { postId } }),
                prisma.post.count({ where: { parentId: postId } }),
                userId ? Promise.all([
                    prisma.like.findFirst({ where: { postId, userId } }),
                    prisma.retweet.findFirst({ where: { postId, userId } })
                ]) : [null, null]
            ]);

            if (!post) return null;

            return {
                ...post,
                likesCount,
                retweetsCount,
                repliesCount,
                isLiked: Boolean(userInteractions[0]),
                isRetweeted: Boolean(userInteractions[1])
            };
        });

        const result = await processor.executeParallel(tasks);
        return result.results
            .filter(r => r.success && r.result)
            .map(r => r.result);
    },

    // Parallel timeline generation for multiple users
    async generateTimelines(prisma, userIds, page = 1, limit = 10) {
        const processor = new ParallelProcessor(3);
        
        const tasks = userIds.map(userId => async () => {
            // Get user's followed users
            const following = await prisma.follow.findMany({
                where: { followerId: userId },
                select: { followeeId: true }
            });

            const followedUserIds = following.map(f => f.followeeId);
            followedUserIds.push(userId); // Include own posts            // Get timeline posts
            const posts = await prisma.post.findMany({
                where: {
                    authorId: { in: followedUserIds }
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true
                        }
                    },
                    _count: {
                        select: {
                            likes: true,
                            retweets: true,
                            replies: true
                        }
                    }
                },
                orderBy: { publishedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            });

            return { userId, posts };
        });

        const result = await processor.executeParallel(tasks);
        return result.results
            .filter(r => r.success)
            .map(r => r.result);
    },

    // Parallel user interaction operations
    async batchUserInteractions(prisma, operations) {
        const processor = new ParallelProcessor(10);
        
        const tasks = operations.map(op => async () => {
            const { type, userId, postId, action } = op;
            
            switch (type) {
                case 'like':
                    if (action === 'add') {
                        return await prisma.like.create({
                            data: { userId, postId }
                        });
                    } else {
                        return await prisma.like.delete({
                            where: {
                                userId_postId: { userId, postId }
                            }
                        });
                    }
                
                case 'retweet':
                    if (action === 'add') {
                        return await prisma.retweet.create({
                            data: { userId, postId }
                        });
                    } else {
                        return await prisma.retweet.delete({
                            where: {
                                userId_postId: { userId, postId }
                            }
                        });
                    }
                
                default:
                    throw new Error(`Unknown operation type: ${type}`);
            }
        });

        return await processor.executeParallel(tasks);
    }
};

// Batch processing utilities
export const batchProcessor = {
    // Process items in batches with configurable batch size
    async processBatches(items, processor, batchSize = 100, delayMs = 0) {
        const results = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResult = await processor(batch, i / batchSize);
            results.push(batchResult);
            
            // Optional delay between batches to prevent overwhelming the system
            if (delayMs > 0 && i + batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        return results;
    },

    // Batch database operations with transaction support
    async batchDatabaseOperations(prisma, operations, batchSize = 50) {
        return await this.processBatches(operations, async (batch) => {
            return await prisma.$transaction(batch);
        }, batchSize);
    },

    // Parallel batch processing
    async parallelBatches(items, processor, batchSize = 100, maxConcurrency = 3) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }

        const parallelProcessor = new ParallelProcessor(maxConcurrency);
        const tasks = batches.map((batch, index) => () => processor(batch, index));
        
        return await parallelProcessor.executeParallel(tasks);
    }
};

// Async utilities for common operations
export const asyncUtils = {
    // Retry operation with exponential backoff
    async retry(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                // Exponential backoff
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    // Timeout wrapper for operations
    async withTimeout(operation, timeoutMs, timeoutMessage = 'Operation timed out') {
        return Promise.race([
            operation(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
            )
        ]);
    },

    // Parallel map with concurrency control
    async parallelMap(items, mapper, concurrency = 10) {
        const processor = new ParallelProcessor(concurrency);
        const tasks = items.map(item => () => mapper(item));
        const result = await processor.executeParallel(tasks);
        
        return result.results
            .filter(r => r.success)
            .map(r => r.result);
    },

    // Sequential processing when parallel isn't suitable
    async sequential(operations) {
        const results = [];
        for (const operation of operations) {
            const result = await (typeof operation === 'function' ? operation() : operation);
            results.push(result);
        }
        return results;
    }
};

// Performance-optimized database queries
export const optimizedQueries = {
    // Efficient post search with parallel processing
    async searchPosts(prisma, query, filters = {}, page = 1, limit = 10) {
        const { userId, dateFrom, dateTo, hasMedia } = filters;
        
        // Build search conditions
        const whereConditions = {
            content: {
                contains: query,
                mode: 'insensitive'
            }
        };

        if (userId) whereConditions.authorId = userId;
        if (dateFrom || dateTo) {            whereConditions.publishedAt = {};
            if (dateFrom) whereConditions.publishedAt.gte = new Date(dateFrom);
            if (dateTo) whereConditions.publishedAt.lte = new Date(dateTo);
        }        // Parallel execution of count and data queries
        const [posts, totalCount] = await Promise.all([
            prisma.post.findMany({
                where: whereConditions,
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true
                        }
                    },
                    _count: {
                        select: {
                            likes: true,
                            retweets: true,
                            replies: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.yeet.count({ where: whereConditions })
        ]);

        return {
            posts,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    },

    // Optimized user activity feed
    async getUserActivity(prisma, userId, includeInteractions = true) {
        const tasks = [
            // User's posts
            prisma.yeet.findMany({
                where: { authorId: userId },
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { likes: true, retweets: true, replies: true }
                    }
                }
            })
        ];

        if (includeInteractions) {
            tasks.push(
                // User's likes
                prisma.like.findMany({
                    where: { userId },
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        post: {
                            include: {
                                author: {
                                    select: { id: true, username: true}
                                }
                            }
                        }
                    }
                }),
                // User's retweets
                prisma.retweet.findMany({
                    where: { userId },
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        post: {
                            include: {
                                author: {
                                    select: { id: true, username: true}
                                }
                            }
                        }
                    }
                })
            );
        }

        const results = await Promise.all(tasks);
        
        return {
            posts: results[0],
            likes: results[1] || [],
            retweets: results[2] || []
        };
    }
};

// Create global processor instance
export const globalProcessor = new ParallelProcessor(10);

export default {
    ParallelProcessor,
    postOperations,
    batchProcessor,
    asyncUtils,
    optimizedQueries,
    globalProcessor
};
