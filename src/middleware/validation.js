/**
 * Input validation middleware for post-service
 * Provides comprehensive validation for post operations and user inputs
 */

import { body, param, query, validationResult } from 'express-validator';

// Custom error formatter
const formatValidationErrors = (errors) => {
    return errors.array().map(error => ({
        field: error.path,
        value: error.value,
        message: error.msg,
        location: error.location
    }));
};

// Validation result handler
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: formatValidationErrors(errors),
            correlationId: req.correlationId
        });
    }
    next();
};

// Post content validation
export const validatePostContent = [
    body('content')
        .notEmpty()
        .withMessage('Content is required')
        .isLength({ min: 1, max: 280 })
        .withMessage('Content must be between 1 and 280 characters')
        .trim()
        .escape(), // XSS protection
    
    body('image')
        .optional()
        .isURL()
        .withMessage('Image must be a valid URL')
        .isLength({ max: 2048 })
        .withMessage('Image URL too long'),
    
    handleValidationErrors
];

// Post creation validation
export const validateCreatePost = [
    ...validatePostContent,
    
    // Note: authUserId comes from authentication token (req.user.userId), not request body
    // No need to validate it in the body since it's extracted from the authenticated user
    
    handleValidationErrors
];

// Post ID validation
export const validatePostId = [
    param('id')
        .notEmpty()
        .withMessage('Post ID is required')
        .isUUID()
        .withMessage('Post ID must be a valid UUID'),
    
    handleValidationErrors
];

// User ID validation
export const validateUserId = [
    param('userId')
        .notEmpty()
        .withMessage('User ID is required')
        .isUUID()
        .withMessage('User ID must be a valid UUID'),
    
    handleValidationErrors
];

// Pagination validation
export const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt(),
    
    handleValidationErrors
];

// Search validation
export const validateSearch = [
    query('q')
        .notEmpty()
        .withMessage('Search query is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
        .trim()
        .escape(),
    
    query('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format for dateFrom'),
    
    query('dateTo')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format for dateTo'),
    
    query('hasMedia')
        .optional()
        .isBoolean()
        .withMessage('hasMedia must be a boolean')
        .toBoolean(),
    
    ...validatePagination
];

// Like/Unlike validation
export const validateLikeAction = [
    ...validatePostId,
    
    // Note: userId comes from authentication token (req.user.userId), not request body
    // No need to validate it in the body since it's extracted from the authenticated user
    
    handleValidationErrors
];

// Retweet validation
export const validateRetweetAction = [
    ...validatePostId,
    
    // Note: userId comes from authentication token (req.user.userId), not request body
    // No need to validate it in the body since it's extracted from the authenticated user
    
    handleValidationErrors
];

// Timeline validation
export const validateTimelineRequest = [
    ...validateUserId,
    ...validatePagination
];

// Batch operations validation
export const validateBatchRequest = [
    body('postIds')
        .isArray({ min: 1, max: 50 })
        .withMessage('postIds must be an array with 1-50 items'),
    
    body('postIds.*')
        .isUUID()
        .withMessage('Each post ID must be a valid UUID'),
    
    body('userId')
        .optional()
        .isUUID()
        .withMessage('User ID must be a valid UUID'),
    
    handleValidationErrors
];

// Content sanitization helpers
export const sanitizeContent = {
    // Remove potentially harmful content
    cleanHtml: (content) => {
        return content
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/onload\s*=/gi, '')
            .replace(/onerror\s*=/gi, '');
    },
    
    // Validate and clean URLs
    cleanUrl: (url) => {
        try {
            const parsed = new URL(url);
            // Only allow http and https protocols
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error('Invalid protocol');
            }
            return parsed.toString();
        } catch {
            throw new Error('Invalid URL');
        }
    },
    
    // Clean and validate usernames/display names
    cleanUsername: (username) => {
        return username
            .trim()
            .replace(/[^\w\s-_.]/g, '') // Remove special characters except allowed ones
            .substring(0, 50); // Limit length
    }
};

// Rate limiting validation helpers
export const validateRateLimit = {
    // Check if request should be rate limited based on content
    shouldRateLimit: (req) => {
        const { content } = req.body;
        
        // Rate limit if content looks like spam
        const spamIndicators = [
            /(.)\1{10,}/, // Repeated characters
            /http[s]?:\/\/.+http[s]?:\/\//, // Multiple URLs
            /[A-Z]{20,}/, // Too many capitals
            /(.{1,10})\1{5,}/ // Repeated phrases
        ];
        
        return spamIndicators.some(pattern => pattern.test(content));
    },
    
    // Get custom rate limit based on user behavior
    getCustomLimit: (req) => {
        // Could integrate with user reputation system
        const baseLimit = 10; // posts per hour
        const userReputation = req.user?.reputation || 0;
        
        if (userReputation > 100) return baseLimit * 2;
        if (userReputation < 0) return Math.max(1, baseLimit / 2);
        
        return baseLimit;
    }
};

// Security validation
export const validateSecurity = [
    // Check for common attack patterns
    body('*')
        .custom((value, { path }) => {
            if (typeof value === 'string') {
                // Check for SQL injection patterns
                const sqlPatterns = [
                    /(\b(select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
                    /(union\s+select)/i,
                    /(\bor\b\s+\d+\s*=\s*\d+)/i
                ];
                
                // Check for XSS patterns
                const xssPatterns = [
                    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                    /javascript:/i,
                    /vbscript:/i,
                    /on\w+\s*=/i
                ];
                
                const allPatterns = [...sqlPatterns, ...xssPatterns];
                
                if (allPatterns.some(pattern => pattern.test(value))) {
                    throw new Error(`Potentially malicious content detected in ${path}`);
                }
            }
            return true;
        }),
    
    handleValidationErrors
];

// Export all validation rules
export const postValidation = {
    createPost: [...validateSecurity, ...validateCreatePost],
    updatePost: [...validateSecurity, ...validatePostContent],
    getPost: validatePostId,
    deletePost: validatePostId,
    likePost: [...validateSecurity, ...validateLikeAction],
    retweetPost: [...validateSecurity, ...validateRetweetAction],
    getUserTimeline: validateTimelineRequest,
    searchPosts: [...validateSecurity, ...validateSearch],
    batchPosts: [...validateSecurity, ...validateBatchRequest],
    pagination: validatePagination
};

export default {
    postValidation,
    sanitizeContent,
    validateRateLimit,
    handleValidationErrors
};
