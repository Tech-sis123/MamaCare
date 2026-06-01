import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { env } from './env';
import { logger } from '../utils/logger';

const isLocalhost = env.REDIS_URL.includes('localhost') || env.REDIS_URL.includes('127.0.0.1');

// Main Redis client for commands (SET, GET, LPUSH, etc.)
export const redis = isLocalhost
  ? (new RedisMock() as unknown as Redis)
  : new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

redis.on('connect', () => {
  logger.info(isLocalhost ? 'Redis Mock connected (Localhost Fallback)' : 'Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

// Separate Redis client for pub/sub (subscribed clients can't issue other commands)
export const createSubscriberClient = (): Redis => {
  const sub = isLocalhost
    ? (new RedisMock() as unknown as Redis)
    : new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

  sub.on('error', (err) => {
    logger.error({ err }, 'Redis subscriber error');
  });

  return sub;
};
