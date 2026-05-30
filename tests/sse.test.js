"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const controller_1 = require("../src/modules/alerts/controller");
const redis_1 = require("../src/config/redis");
// Mock Redis client and Redis connection
vitest_1.vi.mock('../src/config/redis', () => {
    const mockSub = {
        subscribe: vitest_1.vi.fn().mockResolvedValue(undefined),
        unsubscribe: vitest_1.vi.fn().mockResolvedValue(undefined),
        quit: vitest_1.vi.fn().mockResolvedValue(undefined),
        on: vitest_1.vi.fn(),
    };
    return {
        redis: {
            lrange: vitest_1.vi.fn().mockResolvedValue(['{"alert_id":"cached-123"}']),
        },
        createSubscriberClient: vitest_1.vi.fn(() => mockSub),
    };
});
(0, vitest_1.describe)('SSE Subscription Flow', () => {
    let mockReq;
    let mockRes;
    let nextFn;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockReq = {
            user: { id: 'doctor-uuid-1', role: 'doctor', type: 'doctor' },
            on: vitest_1.vi.fn(), // for disconnect listener
        };
        mockRes = {
            writeHead: vitest_1.vi.fn(),
            flushHeaders: vitest_1.vi.fn(),
            write: vitest_1.vi.fn(),
        };
        nextFn = vitest_1.vi.fn();
    });
    (0, vitest_1.it)('should initialize SSE stream and load cached active alerts from Redis list', async () => {
        await controller_1.alertsController.subscribe(mockReq, mockRes, nextFn);
        // Expecting 200 HTTP headers to initiate Server-Sent Events
        (0, vitest_1.expect)(mockRes.writeHead).toHaveBeenCalledWith(200, vitest_1.expect.objectContaining({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        }));
        (0, vitest_1.expect)(mockRes.flushHeaders).toHaveBeenCalled();
        // Check that lrange was fetched and sent to write
        (0, vitest_1.expect)(redis_1.redis.lrange).toHaveBeenCalledWith('doctor:doctor-uuid-1:active_alerts', 0, -1);
        (0, vitest_1.expect)(mockRes.write).toHaveBeenCalledWith(vitest_1.expect.stringContaining('{"alert_id":"cached-123"}'));
    });
});
