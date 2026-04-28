/**
 * lib/db.ts — Neon PostgreSQL serverless client
 *
 * Uses @neondatabase/serverless which works in both Node.js (dev) and
 * edge runtimes (Vercel Edge, Cloudflare Workers).
 *
 * Usage (server components / API routes only — never import in client components):
 *   import { getSql } from '@/lib/db';
 *   const sql = getSql();
 *   const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
 */

import { neon } from '@neondatabase/serverless';
import type { NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Lazy getter — only creates the Neon client on first call so that
 * importing this module never throws when DATABASE_URL is absent (e.g. during
 * build or test runs that don't need a DB connection).
 */
export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not set. Add it to .env.local:\n' +
        'DATABASE_URL=postgresql://neondb_owner:<password>@<host>/neondb?sslmode=require'
      );
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

/**
 * Tagged-template SQL helper (convenience re-export).
 * @example
 *   const { sql } = await import('@/lib/db'); // or use getSql()
 *   const users = await sql`SELECT id, email FROM users LIMIT 20`;
 */
export function sql(...args: Parameters<NeonQueryFunction<false, false>>) {
  return getSql()(...args);
}
