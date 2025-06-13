/**
 * Rate limiting middleware for post-service
 * Provides multi-tier rate limiting with in-memory store
 */

import rateLimit from 'express-rate-limit';

// Custom key generator for rate limiting
const createKeyGenerator = (prefix) => {
    return (req) => {
        const userId = req.user?.id || req.body?.authUserId || req.body?.userId;
        const ip = req.ip || req.connection.remoteAddress;
        return `${prefix}:${userId || ip}`;
    };
};

// Custom rate limit message
const createRateLimitMessage = (windowMs, max) => {
    return {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
        retryAfter: windowMs,
        limit: max,
        correlationId: undefined // Will be set by middleware
    };
};

// Failed request tracking for suspicious activity
const failedRequests = new Map();

const trackFailedRequest = (key) => {
    const count = failedRequests.get(key) || 0;
    failedRequests.set(key, count + 1);
    
    // Clean up old entries (every 100 failed requests)
    if (failedRequests.size > 1000) {
        const entries = Array.from(failedRequests.entries());
        entries.slice(0, 100).forEach(([k]) => failedRequests.delete(k));
    }
    
    return count + 1;
};

// Post creation rate limiting - stricter limits
export const postCreationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 posts per 15 minutes
    keyGenerator: createKeyGenerator('post_create'),    message: createRateLimitMessage(15 * 60 * 1000, 20),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, options) => {
        const key = options.keyGenerator(req);
        trackFailedRequest(key);
        console.warn(`Post creation rate limit exceeded for ${key}`);
        const message = createRateLimitMessage(15 * 60 * 1000, 20);
        message.correlationId = req.correlationId;
        res.status(429).json(message);
    }
});

// Like/Unlike rate limiting
export const interactionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 interactions per minute
    keyGenerator: createKeyGenerator('post_interaction'),    message: createRateLimitMessage(60 * 1000, 30),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, options) => {
        const key = options.keyGenerator(req);
        console.warn(`Interaction rate limit exceeded for ${key}`);
        const message = createRateLimitMessage(60 * 1000, 30);
        message.correlationId = req.correlationId;
        res.status(429).json(message);
    }
});

// General API rate limiting
export const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    keyGenerator: createKeyGenerator('api_general'),    message: createRateLimitMessage(15 * 60 * 1000, 100),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, options) => {
        const key = options.keyGenerator(req);
        console.warn(`General API rate limit exceeded for ${key}`);
        const message = createRateLimitMessage(15 * 60 * 1000, 100);
        message.correlationId = req.correlationId;
        res.status(429).json(message);
    }
});

// Timeline/Feed rate limiting
export const timelineLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 timeline requests per minute
    keyGenerator: createKeyGenerator('timeline'),
    message: createRateLimitMessage(60 * 1000, 20),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const message = createRateLimitMessage(60 * 1000, 20);
        message.correlationId = req.correlationId;
        res.status(429).json(message);
    }
});

// Search rate limiting
export const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 searches per minute
    keyGenerator: createKeyGenerator('search'),
    message: createRateLimitMessage(60 * 1000, 10),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const message = createRateLimitMessage(60 * 1000, 10);
        message.correlationId = req.correlationId;
        res.status(429).json(message);
    }
});

// Suspicious activity detector
export const suspiciousActivityLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 suspicious requests per hour before blocking
    keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        return `suspicious:${ip}`;
    },
    skip: (req) => {
        // Check for suspicious patterns
        const userAgent = req.get('User-Agent') || '';
        const hasUserAgent = userAgent.length > 0;
        const isBot = /bot|crawler|spider|scraper/i.test(userAgent);
        const hasValidReferer = req.get('Referer') && req.get('Referer').includes(process.env.FRONTEND_URL || 'localhost');
        
        // Skip rate limiting for normal requests
        return hasUserAgent && !isBot && hasValidReferer;
    },    message: {
        error: 'Account temporarily restricted',
        message: 'Suspicious activity detected. Account temporarily restricted.',
        retryAfter: 60 * 60 * 1000 // 1 hour
    },
    handler: (req, res, options) => {
        const ip = req.ip || req.connection.remoteAddress;
        console.error(`Suspicious activity detected from IP: ${ip}`);
        // Could trigger additional security measures here
        res.status(429).json({
            error: 'Account temporarily restricted',
            message: 'Suspicious activity detected. Account temporarily restricted.',
            retryAfter: 60 * 60 * 1000,
            correlationId: req.correlationId
        });
    }
});

// Dynamic rate limiting based on user behavior
export const createDynamicLimiter = (baseWindowMs, baseMax) => {
    return rateLimit({
        windowMs: baseWindowMs,
        max: (req) => {
            // Adjust limits based on user reputation or behavior
            const userId = req.user?.id || req.body?.authUserId;
            const failedCount = failedRequests.get(`post_create:${userId}`) || 0;
            
            // Reduce limits for users with many failed requests
            if (failedCount > 10) return Math.max(1, baseMax / 4);
            if (failedCount > 5) return Math.max(2, baseMax / 2);
            
            return baseMax;
        },
        keyGenerator: createKeyGenerator('dynamic'),
        message: createRateLimitMessage(baseWindowMs, baseMax),
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            const message = createRateLimitMessage(baseWindowMs, baseMax);
            message.correlationId = req.correlationId;
            res.status(429).json(message);
        }
    });
};

// Burst protection for high-frequency operations
export const burstLimiter = rateLimit({
    windowMs: 1000, // 1 second
    max: 5, // 5 requests per second
    keyGenerator: createKeyGenerator('burst'),
    message: {
        error: 'Too many requests',
        message: 'Please slow down your requests',
        retryAfter: 1000
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Please slow down your requests',
            retryAfter: 1000,
            correlationId: req.correlationId
        });
    }
});

// Export rate limiting stats (in-memory only, no Redis)
export const getRateLimitStats = async () => {
    try {
        const stats = {
            failedRequestsTracked: failedRequests.size,
            inMemoryStore: true
        };

        return stats;
    } catch (error) {
        console.error('Error getting rate limit stats:', error);
        return { error: 'Unable to get stats' };
    }
};

// Cleanup function (in-memory only)
export const cleanup = () => {
    failedRequests.clear();
};

// Factory function to create rate limiters by type
export const createRateLimit = (type) => {
    switch (type) {
        case 'general':
            return generalApiLimiter;
        case 'write':
            return postCreationLimiter;
        case 'read':
            return timelineLimiter;
        case 'interaction':
            return interactionLimiter;
        case 'search':
            return searchLimiter;
        case 'burst':
            return burstLimiter;
        default:
            return generalApiLimiter;
    }
};

export default {
    postCreationLimiter,
    interactionLimiter,
    generalApiLimiter,
    timelineLimiter,
    searchLimiter,
    suspiciousActivityLimiter,
    createDynamicLimiter,
    burstLimiter,
    getRateLimitStats,
    createRateLimit,
    cleanup
};
