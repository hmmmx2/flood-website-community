import { defineConfig } from 'cypress';
import * as fs from 'fs';
import * as path from 'path';

/**
 * True dynamic import that survives Cypress's CJS bundling of this config.
 * `next-auth/jwt` is ESM-only; a literal `import()` would be transpiled to
 * `require()` and throw `ERR_REQUIRE_ESM`. Wrapping it in `new Function`
 * keeps a genuine runtime dynamic import, which Node allows from CJS.
 */
const esmImport = new Function('m', 'return import(m)') as (
  m: string,
) => Promise<unknown>;

/** Read AUTH_SECRET from the process env, then `.env.local`, then `.env`. */
function readAuthSecret(): string | null {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length > 0) {
    return process.env.AUTH_SECRET;
  }
  for (const file of ['.env.local', '.env']) {
    const p = path.resolve(__dirname, file);
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    const m = txt.match(/^\s*AUTH_SECRET\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

interface SignSessionArgs {
  /** Dev (http) cookie name = JWT salt. */
  salt: string;
  token: Record<string, unknown>;
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3002',
    specPattern: 'cypress/e2e/community/**/*.cy.ts',
    excludeSpecPattern: ['cypress/e2e/_legacy/**'],
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    experimentalRunAllSpecs: true,
    setupNodeEvents(on, config) {
      on('task', {
        log(message: string) {
          // eslint-disable-next-line no-console
          console.log(message);
          return null;
        },

        /**
         * Mint a real NextAuth (Auth.js v5) session JWE so the edge
         * middleware (`proxy.ts`) treats SSR-gated routes such as
         * `/settings` as authenticated. Returns the encoded cookie
         * value, or `null` if AUTH_SECRET can't be resolved (the
         * caller then skips cookie-dependent assertions rather than
         * failing the run).
         */
        async signSession({ salt, token }: SignSessionArgs): Promise<string | null> {
          const secret = readAuthSecret();
          if (!secret) {
            // eslint-disable-next-line no-console
            console.warn(
              '[signSession] AUTH_SECRET not found (.env.local / .env / env). ' +
                '/settings SSR-gated tests will be skipped.',
            );
            return null;
          }
          try {
            const jwt = (await esmImport('next-auth/jwt')) as {
              encode: (params: {
                token: Record<string, unknown>;
                secret: string | string[];
                salt: string;
                maxAge?: number;
              }) => Promise<string>;
            };
            return await jwt.encode({
              token,
              secret,
              salt,
              maxAge: 30 * 24 * 60 * 60,
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[signSession] encode failed:', (err as Error).message);
            return null;
          }
        },
      });
      return config;
    },
  },
  env: {
    USER_EMAIL: 'user@example.com',
    USER_PASSWORD: 'Password@123',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'Admin@123',
    // Dev (http://localhost) session cookie name — also the JWT salt.
    SESSION_COOKIE: 'authjs.session-token',
    MOCK_USER_ID: '11111111-1111-4111-8111-111111111111',
  },
});
