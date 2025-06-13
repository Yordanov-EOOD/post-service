/**
 * Security middleware for post-service
 * Provides comprehensive security headers and protection
 */

import helmet from 'helmet';

// Content Security Policy configuration
const cspConfig = {
    directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:"],
        frameSrc: ["'none'"],
        connectSrc: ["'self'", "wss:", "https:"],
        workerSrc: ["'self'"],
        childSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"]
    },
    reportOnly: process.env.NODE_ENV === 'development'
};

// Helmet configuration
export const securityHeaders = helmet({
    // Content Security Policy
    contentSecurityPolicy: cspConfig,
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
        allow: false
    },
    
    // Frame Guard
    frameguard: {
        action: 'deny'
    },
    
    // Hide Powered By
    hidePoweredBy: true,
    
    // HTTP Strict Transport Security
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // Don't Sniff Mimetype
    noSniff: true,
    
    // Origin Agent Cluster
    originAgentCluster: true,
    
    // Permitted Cross Domain Policies
    permittedCrossDomainPolicies: false,
    
    // Referrer Policy
    referrerPolicy: {
        policy: ["no-referrer", "strict-origin-when-cross-origin"]
    },
    
    // X-XSS-Protection
    xssFilter: true
});

// Custom security middleware for API endpoints
export const apiSecurity = (req, res, next) => {
    // Add additional security headers for API
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    // Set cache control for API responses
    if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes for GET
    } else {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
};

// Sensitive endpoint security (for auth-related operations)
export const sensitiveEndpointSecurity = (req, res, next) => {
    // Extra strict headers for sensitive operations
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    
    next();
};

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            // Remove null bytes
            value = value.replace(/\0/g, '');
            
            // Limit string length to prevent DOS attacks
            if (value.length > 10000) {
                value = value.substring(0, 10000);
            }
        }
        
        return value;
    };
    
    const sanitizeObject = (obj) => {
        if (obj && typeof obj === 'object') {
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                    sanitizeObject(obj[key]);
                } else {
                    obj[key] = sanitizeValue(obj[key]);
                }
            }
        }
    };
    
    // Sanitize request body
    if (req.body) {
        sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
        sanitizeObject(req.query);
    }
    
    next();
};

// Request size limiter
export const requestSizeLimiter = (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length')) || 0;
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (contentLength > maxSize) {
        return res.status(413).json({
            error: 'Payload too large',
            message: 'Request body exceeds maximum allowed size',
            maxSize: `${maxSize / 1024 / 1024}MB`,
            correlationId: req.correlationId
        });
    }
    
    next();
};

// IP whitelist/blacklist middleware
export const ipFilter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    // Blacklisted IPs (could be loaded from database or config)
    const blacklistedIPs = (process.env.BLACKLISTED_IPS || '').split(',').filter(Boolean);
    
    if (blacklistedIPs.includes(ip)) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Your IP address has been blocked',
            correlationId: req.correlationId
        });
    }
    
    // Whitelist for admin endpoints (if needed)
    const whitelistedIPs = (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean);
    
    if (req.path.startsWith('/admin') && whitelistedIPs.length > 0) {
        if (!whitelistedIPs.includes(ip)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Admin access restricted to whitelisted IPs',
                correlationId: req.correlationId
            });
        }
    }
    
    next();
};

// Security event logger
export const securityLogger = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
        // Log security-related responses
        if (res.statusCode >= 400) {
            const securityEvent = {
                timestamp: new Date().toISOString(),
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                correlationId: req.correlationId,
                userId: req.user?.id || req.body?.authUserId
            };
            
            // Log different types of security events
            if (res.statusCode === 401) {
                console.warn('Authentication failure:', securityEvent);
            } else if (res.statusCode === 403) {
                console.warn('Authorization failure:', securityEvent);
            } else if (res.statusCode === 429) {
                console.warn('Rate limit exceeded:', securityEvent);
            } else if (res.statusCode === 400 && body.includes('Validation failed')) {
                console.warn('Validation failure:', securityEvent);
            }
        }
        
        originalSend.call(this, body);
    };
      next();
};

// General request logger
export const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(body) {
        const duration = Date.now() - startTime;
        console.log({
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            correlationId: req.correlationId
        });
        
        originalSend.call(this, body);
    };
    
    next();
};

// Correlation ID generator for request tracking
export const correlationId = (req, res, next) => {
    const id = req.get('X-Correlation-ID') || 
              `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    req.correlationId = id;
    res.setHeader('X-Correlation-ID', id);
    
    next();
};

// Alias for correlationId
export const correlationMiddleware = correlationId;

// User agent validation
export const validateUserAgent = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    
    if (!userAgent || userAgent.trim() === '') {
        return res.status(400).json({
            error: 'Bad request',
            message: 'User-Agent header is required',
            correlationId: req.correlationId
        });
    }
    
    // Block known malicious user agents
    const blockedAgents = [
        /sqlmap/i,
        /nikto/i,
        /nessus/i,
        /burp/i,
        /nmap/i
    ];
    
    if (blockedAgents.some(pattern => pattern.test(userAgent))) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Blocked user agent detected',
            correlationId: req.correlationId
        });
    }
    
    next();
};

// Complete security middleware stack
export const securityStack = [
    correlationId,
    securityHeaders,
    apiSecurity,
    sanitizeInput,
    requestSizeLimiter,
    ipFilter,
    validateUserAgent,
    securityLogger
];

export default {
    securityHeaders,
    apiSecurity,
    sensitiveEndpointSecurity,
    sanitizeInput,
    requestSizeLimiter,
    ipFilter,
    securityLogger,
    correlationId,
    validateUserAgent,
    securityStack
};
