import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export const rateLimiter = (options: RateLimitOptions) => {
  const { windowMs, max, keyPrefix = 'rl' } = options;
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current).toString());

      if (current > max) {
        throw new TooManyRequestsError('Too many requests, please try again later');
      }

      next();
    } catch (err) {
      if (err instanceof TooManyRequestsError) {
        throw err;
      }
      // If Redis is down, fail open (allow the request)
      next();
    }
  };
};

// Pre-configured rate limiters
export const authRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyPrefix: 'rl:auth',
});
