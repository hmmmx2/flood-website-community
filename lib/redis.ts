/**
 * lib/redis.ts — Upstash Redis HTTP client (server-only)
 *
 * Upstash Redis uses a REST API, compatible with serverless and edge runtimes.
 *
 * Usage:
 *   import { redis, CACHE_TTL, withCache } from '@/lib/redis';
 */

import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    'Upstash Redis env vars missing. Add to .env.local:\n' +
    'UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io\n' +
    'UPSTASH_REDIS_REST_TOKEN=<your-token>'
  );
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** Cache TTL constants (seconds) */
export const CACHE_TTL = {
  /** Posts/feed — 30 s rolling window */
  posts: 30,
  /** Groups list — 2 min (low churn) */
  groups: 120,
  /** Blog articles — 10 min */
  blogs: 600,
  /** User profile — 5 min */
  profile: 300,
  /** Sensor alerts — 60 s */
  alerts: 60,
} as const;

/**
 * Cache-aside helper — Redis first, then fetcher on miss.
 *
 * @example
 *   const posts = await withCache('posts:page:0', CACHE_TTL.posts, () =>
 *     javaFetch('/community/posts?page=0')
 *   );
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  } catch {
    console.warn(`[redis] cache read failed for key "${key}" — falling back to source`);
  }

  const fresh = await fetcher();

  try {
    await redis.set(key, JSON.stringify(fresh), { ex: ttl });
  } catch {
    console.warn(`[redis] cache write failed for key "${key}"`);
  }

  return fresh;
}

/**
 * Invalidate one or more cache keys after mutations.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    console.warn('[redis] cache invalidation failed:', keys);
  }
}
