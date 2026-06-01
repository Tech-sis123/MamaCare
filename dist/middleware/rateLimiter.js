"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = exports.rateLimiter = void 0;
const redis_1 = require("../config/redis");
const errors_1 = require("../utils/errors");
const rateLimiter = (options) => {
    const { windowMs, max, keyPrefix = 'rl' } = options;
    const windowSeconds = Math.ceil(windowMs / 1000);
    return async (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${keyPrefix}:${ip}`;
        try {
            const current = await redis_1.redis.incr(key);
            if (current === 1) {
                await redis_1.redis.expire(key, windowSeconds);
            }
            res.setHeader('X-RateLimit-Limit', max.toString());
            res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current).toString());
            if (current > max) {
                throw new errors_1.TooManyRequestsError('Too many requests, please try again later');
            }
            next();
        }
        catch (err) {
            if (err instanceof errors_1.TooManyRequestsError) {
                throw err;
            }
            // If Redis is down, fail open (allow the request)
            next();
        }
    };
};
exports.rateLimiter = rateLimiter;
// Pre-configured rate limiters
exports.authRateLimiter = (0, exports.rateLimiter)({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    keyPrefix: 'rl:auth',
});
