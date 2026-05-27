import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alertsController } from '../src/modules/alerts/controller';
import { AuthRequest } from '../src/utils/types';
import { Response } from 'express';
import { redis } from '../src/config/redis';

// Mock Redis client and Redis connection
vi.mock('../src/config/redis', () => {
  const mockSub = {
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
  return {
    redis: {
      lrange: vi.fn().mockResolvedValue(['{"alert_id":"cached-123"}']),
    },
    createSubscriberClient: vi.fn(() => mockSub),
  };
});

describe('SSE Subscription Flow', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      user: { id: 'doctor-uuid-1', role: 'doctor', type: 'doctor' },
      on: vi.fn(), // for disconnect listener
    };

    mockRes = {
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
    };

    nextFn = vi.fn();
  });

  it('should initialize SSE stream and load cached active alerts from Redis list', async () => {
    await alertsController.subscribe(mockReq as AuthRequest, mockRes as unknown as Response, nextFn);

    // Expecting 200 HTTP headers to initiate Server-Sent Events
    expect(mockRes.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
    );

    expect(mockRes.flushHeaders).toHaveBeenCalled();

    // Check that lrange was fetched and sent to write
    expect(redis.lrange).toHaveBeenCalledWith('doctor:doctor-uuid-1:active_alerts', 0, -1);
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('{"alert_id":"cached-123"}')
    );
  });
});
