import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createSlidingWindowRateLimiter } from '../../../src/core/rate-limit/sliding-window-rate-limit.js';

const WINDOW_MS = 15 * 60 * 1000;

describe('sliding window rate limiter', () => {
  for (const { operation, limit } of [
    { operation: 'request', limit: 5 },
    { operation: 'verify', limit: 10 },
    { operation: 'confirm', limit: 10 }
  ]) {
    test(`${operation} keeps late attempts across the fifteen-minute boundary`, () => {
      let now = 0;
      const limiter = createSlidingWindowRateLimiter({
        limit,
        windowMs: WINDOW_MS,
        now: () => now
      });

      assert.equal(limiter.consume('203.0.113.9').allowed, true);
      now = WINDOW_MS - 1;
      for (let attempt = 2; attempt <= limit; attempt += 1) {
        assert.equal(limiter.consume('203.0.113.9').allowed, true);
      }

      const beforeBoundary = limiter.consume('203.0.113.9');
      assert.deepEqual(beforeBoundary, {
        allowed: false,
        remaining: 0,
        retryAfterMs: 1
      });

      now = WINDOW_MS;
      assert.deepEqual(limiter.consume('203.0.113.9'), {
        allowed: true,
        remaining: 0,
        retryAfterMs: 0
      });
      assert.equal(limiter.consume('203.0.113.9').allowed, false);
    });
  }

  test('tracks source keys independently', () => {
    const limiter = createSlidingWindowRateLimiter({
      limit: 1,
      windowMs: WINDOW_MS,
      now: () => 42
    });

    assert.equal(limiter.consume('203.0.113.9').allowed, true);
    assert.equal(limiter.consume('203.0.113.10').allowed, true);
    assert.equal(limiter.consume('203.0.113.9').allowed, false);
  });
});
