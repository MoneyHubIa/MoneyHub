export type SlidingWindowRateLimitResult = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}>;

type SlidingWindowRateLimiterOptions = Readonly<{
  limit: number;
  windowMs: number;
  now?: () => number;
}>;

export function createSlidingWindowRateLimiter(
  options: SlidingWindowRateLimiterOptions
) {
  const attemptsByKey = new Map<string, number[]>();
  const now = options.now ?? Date.now;

  return {
    consume(key: string): SlidingWindowRateLimitResult {
      const consumedAt = now();
      const cutoff = consumedAt - options.windowMs;
      const attempts = (attemptsByKey.get(key) ?? []).filter(
        (attemptedAt) => attemptedAt > cutoff
      );

      if (attempts.length >= options.limit) {
        attemptsByKey.set(key, attempts);
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(
            0,
            (attempts[0] ?? consumedAt) + options.windowMs - consumedAt
          )
        };
      }

      attempts.push(consumedAt);
      attemptsByKey.set(key, attempts);
      return {
        allowed: true,
        remaining: options.limit - attempts.length,
        retryAfterMs: 0
      };
    }
  };
}
