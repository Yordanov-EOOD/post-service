/**
 * Cache utility for post-service
 * Provides LRU caching for database queries and post data
 */

class LRUCache {
    constructor(maxSize = 1000, ttl = 300000) { // 5 minutes default TTL
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.cache = new Map();
        this.timers = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }

    _isExpired(entry) {
        return Date.now() > entry.expiry;
    }

    _moveToFront(key) {
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    _evictExpired() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.delete(key);
            }
        }
    }

    get(key) {
        this._evictExpired();
        
        if (!this.cache.has(key)) {
            this.stats.misses++;
            return null;
        }

        const entry = this.cache.get(key);
        if (this._isExpired(entry)) {
            this.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return this._moveToFront(key).data;
    }

    set(key, value, customTtl = null) {
        this._evictExpired();
        
        const ttl = customTtl || this.ttl;
        const expiry = Date.now() + ttl;
        
        // Clear existing timer if key exists
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Evict oldest if cache is full
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            this.delete(firstKey);
        }

        this.cache.set(key, { data: value, expiry });
        
        // Set expiration timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttl);
        this.timers.set(key, timer);
        
        this.stats.sets++;
        return true;
    }

    delete(key) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
            this.stats.deletes++;
        }
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        return true;
    }

    clear() {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    }

    size() {
        this._evictExpired();
        return this.cache.size;
    }    getStats() {
        const { hits, misses } = this.stats;
        const total = hits + misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? (hits / total * 100).toFixed(2) + '%' : '0%',
            size: this.size(),
            maxSize: this.maxSize
        };
    }

    // Connection-like methods for compatibility with external cache systems
    async ping() {
        // For in-memory cache, always return true
        return true;
    }

    async initialize() {
        // Initialize the cache (for in-memory cache, nothing to do)
        return true;
    }

    async close() {
        // Close cache connections (for in-memory cache, just clear)
        this.clear();
        return true;
    }

    keys() {
        this._evictExpired();
        return Array.from(this.cache.keys());
    }

    has(key) {
        this._evictExpired();
        return this.cache.has(key) && !this._isExpired(this.cache.get(key));
    }
}

// Cache instances for different data types
export const postCache = new LRUCache(500, 600000); // 10 minutes for posts
export const userCache = new LRUCache(200, 900000); // 15 minutes for user data
export const timelineCache = new LRUCache(100, 300000); // 5 minutes for timelines
export const queryCache = new LRUCache(1000, 180000); // 3 minutes for query results

// Main cache instance for general use
export const cache = new LRUCache(1000, 300000); // 5 minutes for general caching

// Cache key generators
export const generateCacheKey = {
    post: (id) => `post:${id}`,
    userPosts: (userId, page = 1, limit = 10) => `user_posts:${userId}:${page}:${limit}`,
    timeline: (userId, page = 1, limit = 10) => `timeline:${userId}:${page}:${limit}`,
    postLikes: (postId) => `post_likes:${postId}`,
    postRetweets: (postId) => `post_retweets:${postId}`,
    userProfile: (userId) => `user_profile:${userId}`,
    postStats: (postId) => `post_stats:${postId}`,
    trendingPosts: (page = 1, limit = 10) => `trending:${page}:${limit}`
};

// Cache helper functions
export const cacheHelpers = {
    // Invalidate related caches when a post is created/updated
    invalidatePostCaches: (postId, userId) => {
        postCache.delete(generateCacheKey.post(postId));
        queryCache.delete(generateCacheKey.postStats(postId));
        
        // Invalidate user's posts cache
        for (let page = 1; page <= 10; page++) {
            for (let limit of [10, 20, 50]) {
                userCache.delete(generateCacheKey.userPosts(userId, page, limit));
            }
        }

        // Invalidate timeline caches (followers' timelines would need more complex logic)
        for (let page = 1; page <= 5; page++) {
            timelineCache.delete(generateCacheKey.timeline(userId, page));
        }
    },

    // Get or set with fallback function
    getOrSet: async (cache, key, fallbackFn, ttl = null) => {
        let data = cache.get(key);
        if (data !== null) {
            return data;
        }

        data = await fallbackFn();
        if (data !== null && data !== undefined) {
            cache.set(key, data, ttl);
        }
        return data;
    },

    // Warm up cache with frequently accessed data
    warmupCache: async (prisma) => {
        try {
            // Cache recent posts
            const recentPosts = await prisma.yeet.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                include: {
                    author: { select: { id: true, username: true, displayName: true } },
                    _count: { select: { likes: true, retweets: true } }
                }
            });

            recentPosts.forEach(post => {
                postCache.set(generateCacheKey.post(post.id), post);
            });

            console.log(`Cache warmed up with ${recentPosts.length} recent posts`);
        } catch (error) {
            console.error('Cache warmup failed:', error);
        }
    }
};

export default LRUCache;
