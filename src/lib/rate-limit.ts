import "server-only";

// Simple in-memory token-bucket rate limiter.
// For a single-process Next.js server this is fine.
// If you ever scale horizontally, replace with a shared store (redis).

type Bucket = {
  count: number;
  resetAt: number;
};

const globalForBuckets = globalThis as unknown as {
  __buckets?: Map<string, Bucket>;
};

const buckets = globalForBuckets.__buckets ?? new Map<string, Bucket>();
globalForBuckets.__buckets = buckets;

// periodic cleanup
const globalForGc = globalThis as unknown as { __bucketGc?: NodeJS.Timeout };
if (!globalForGc.__bucketGc) {
  globalForGc.__bucketGc = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }, 60_000);
  // don't hold the event loop open
  globalForGc.__bucketGc.unref?.();
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(opts: {
  key: string; // e.g. `login:${ip}`
  limit: number; // max hits
  windowMs: number; // window length
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt < now) {
    const fresh = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(opts.key, fresh);
    return { ok: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }
  existing.count += 1;
  if (existing.count > opts.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    resetAt: existing.resetAt,
  };
}
