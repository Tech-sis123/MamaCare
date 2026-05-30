"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscriberClient = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const ioredis_mock_1 = __importDefault(require("ioredis-mock"));
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
const isLocalhost = env_1.env.REDIS_URL.includes('localhost') || env_1.env.REDIS_URL.includes('127.0.0.1');
// Main Redis client for commands (SET, GET, LPUSH, etc.)
exports.redis = isLocalhost
    ? new ioredis_mock_1.default()
    : new ioredis_1.default(env_1.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 3)
                return null;
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
    });
exports.redis.on('connect', () => {
    logger_1.logger.info(isLocalhost ? 'Redis Mock connected (Localhost Fallback)' : 'Redis connected');
});
exports.redis.on('error', (err) => {
    logger_1.logger.error({ err }, 'Redis connection error');
});
// Separate Redis client for pub/sub (subscribed clients can't issue other commands)
const createSubscriberClient = () => {
    const sub = isLocalhost
        ? new ioredis_mock_1.default()
        : new ioredis_1.default(env_1.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3)
                    return null;
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });
    sub.on('error', (err) => {
        logger_1.logger.error({ err }, 'Redis subscriber error');
    });
    return sub;
};
exports.createSubscriberClient = createSubscriberClient;
