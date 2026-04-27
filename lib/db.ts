/**
 * lib/db.ts — Neon PostgreSQL serverless client
 *
 * Uses @neondatabase/serverless which works in both Node.js (dev) and
 * edge runtimes (Vercel Edge, Cloudflare Workers).
 *
 * Usage (server components / API routes only — never import in client components):
 *   import { sql } from '@/lib/db';
 *   const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
 */

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to .env.local:\n' +
    'DATABASE_URL=postgresql://neondb_owner:<password>@<host>/neondb?sslmode=require'
  );
}

/**
 * Tagged-template SQL helper.
 * Safe against SQL injection — values are passed as parameterised args.
 *
 * @example
 *   const users = await sql`SELECT id, email FROM users LIMIT 20`;
 *   const post  = await sql`SELECT * FROM posts WHERE id = ${postId}`;
 */
export const sql = neon(process.env.DATABASE_URL);
