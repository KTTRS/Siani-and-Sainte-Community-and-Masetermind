// Rate Limiting Middleware for SAINTE API
// Uses in-memory store with sliding window algorithm

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

// In-memory store (will be cleared on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  });
}, 60000); // Clean up every minute

// Default rate limit configurations by endpoint type
// These protect high-cost AI endpoints from abuse while enabling natural usage
export const RATE_LIMITS = {
  // Chat endpoints - restrictive (voice is primary)
  chat: { windowMs: 60000, maxRequests: 10 },  // 10/min - text chat rarely used
  
  // Voice endpoints - 10 minute window for natural conversation flow
  // Allows ~60 voice interactions per 10-min session (speak + respond cycles)
  voice: { windowMs: 600000, maxRequests: 60 }, // 60/10min - primary interaction mode
  
  // Standard API endpoints
  api: { windowMs: 60000, maxRequests: 100 },  // 100/min
  
  // Auth endpoints - very restrictive to prevent brute force
  auth: { windowMs: 900000, maxRequests: 10 }, // 10/15min
  
  // Read-heavy endpoints
  read: { windowMs: 60000, maxRequests: 200 }, // 200/min
};

export function createRateLimiter(config: RateLimitConfig) {
  return (req: any, res: any, next: () => void) => {
    // Generate key from IP only by default — never include caller-supplied
    // identifiers (e.g. req.body.userId) because those are attacker-controlled
    // on public/unauthenticated endpoints and can be cycled to evade throttling.
    const keyGenerator = config.keyGenerator || ((r) => {
      const ip = r.ip || r.headers['x-forwarded-for'] || 'unknown';
      return `${ip}`;
    });
    
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    // Create new entry or reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
    }
    
    entry.count++;
    rateLimitStore.set(key, entry);
    
    // Set rate limit headers
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
    
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);
    
    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
        retryAfter: resetSeconds,
      });
    }
    
    next();
  };
}

// Pre-configured rate limiters
export const chatRateLimiter = createRateLimiter(RATE_LIMITS.chat);
export const voiceRateLimiter = createRateLimiter(RATE_LIMITS.voice);
export const apiRateLimiter = createRateLimiter(RATE_LIMITS.api);
export const authRateLimiter = createRateLimiter(RATE_LIMITS.auth);
export const readRateLimiter = createRateLimiter(RATE_LIMITS.read);
