/// <reference types="cypress" />

// ── Type declarations ─────────────────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /** Log in via the UI form, intercepting all auth + feed APIs. */
      login(email?: string, password?: string): Chainable<void>;
      /** Log in by directly seeding localStorage (fast, skips UI). */
      seedAuth(overrides?: Partial<SeedAuthOptions>): Chainable<void>;
      /** Clear all auth keys from localStorage. */
      logout(): Chainable<void>;
      /** Intercept all auth-related API endpoints. */
      interceptAuth(): Chainable<void>;
      /** Intercept sensor endpoints. */
      interceptSensors(): Chainable<void>;
      /** Intercept favourites endpoints. */
      interceptFavourites(): Chainable<void>;
      /** Intercept feed/posts endpoints. */
      interceptFeed(): Chainable<void>;
      /** Intercept blog endpoints. */
      interceptBlogs(): Chainable<void>;
      /** Intercept group endpoints. */
      interceptGroups(): Chainable<void>;
      /** Intercept profile endpoints. */
      interceptProfile(): Chainable<void>;
      /**
       * Generic API interceptor.
       * @param method HTTP method
       * @param path   URL pattern (supports globs)
       * @param fixture Fixture name or response body object
       * @param alias  cy.wait alias (without @)
       */
      interceptApi(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS',
        path: string,
        fixture: string | object,
        alias: string,
      ): Chainable<void>;
      /** Wait for document.readyState === 'complete'. */
      waitForPageLoad(): Chainable<void>;
      /** Legacy alias kept for backwards compat. */
      loginAsUser(): Chainable<void>;
      loginAs(email: string, password: string): Chainable<void>;
    }
  }
}

// ── Supporting types ──────────────────────────────────────────────────────────

interface SeedAuthOptions {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    role: string;
  };
}

const DEFAULT_AUTH: SeedAuthOptions = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  user: {
    id: 'user-uuid-5678',
    email: 'user@example.com',
    displayName: 'Community User',
    avatarUrl: undefined,
    role: 'customer',
  },
};

// ── Auth commands ─────────────────────────────────────────────────────────────

/**
 * Seed localStorage with auth tokens (no UI interaction).
 * Use this in beforeEach for tests that need an authenticated state without
 * testing the login flow itself.
 */
Cypress.Commands.add('seedAuth', (overrides = {}) => {
  const opts: SeedAuthOptions = {
    ...DEFAULT_AUTH,
    ...overrides,
    user: { ...DEFAULT_AUTH.user, ...(overrides.user ?? {}) },
  };
  cy.window().then((win) => {
    win.localStorage.setItem('community_access_token', opts.accessToken);
    win.localStorage.setItem('community_refresh_token', opts.refreshToken);
    win.localStorage.setItem('community_auth_user', JSON.stringify(opts.user));
  });
});

/** Clear auth from localStorage. */
Cypress.Commands.add('logout', () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('community_access_token');
    win.localStorage.removeItem('community_refresh_token');
    win.localStorage.removeItem('community_auth_user');
  });
});

/** Log in via UI form. */
Cypress.Commands.add('login', (
  email = Cypress.env('USER_EMAIL') as string,
  password = Cypress.env('USER_PASSWORD') as string,
) => {
  cy.interceptAuth();
  cy.interceptFeed();
  cy.interceptSensors();
  cy.interceptFavourites();

  cy.visit('/login');
  cy.get('#email, input[type="email"]').first().clear().type(email);
  cy.get('#password, input[type="password"]').first().clear().type(password);
  cy.get('button[type="submit"]').first().click();
  cy.wait('@loginPost');
  cy.url().should('not.include', '/login');
});

// ── API intercept commands ────────────────────────────────────────────────────

Cypress.Commands.add('interceptAuth', () => {
  cy.intercept('POST', '/api/auth/login', { fixture: 'auth.json' }).as('loginPost');
  cy.intercept('POST', '/api/auth/register', { fixture: 'auth.json' }).as('registerPost');
  cy.intercept('POST', '/api/auth/refresh', {
    body: { accessToken: 'mock-access-token-refreshed' },
  }).as('refreshToken');
  cy.intercept('POST', '/api/auth/forgot-password', {
    body: { message: 'Reset code sent to your email.' },
  }).as('forgotPassword');
  cy.intercept('POST', '/api/auth/verify-reset-code', {
    body: { message: 'Code verified.' },
  }).as('verifyResetCode');
  cy.intercept('POST', '/api/auth/reset-password', {
    body: { message: 'Password reset successfully.' },
  }).as('resetPassword');
  cy.intercept('POST', '/api/auth/change-password', {
    body: { message: 'Password changed successfully.' },
  }).as('changePassword');
});

Cypress.Commands.add('interceptProfile', () => {
  cy.intercept('GET', '/api/auth/profile', {
    body: {
      id: 'user-uuid-5678',
      email: 'user@example.com',
      displayName: 'Community User',
      avatarUrl: null,
      role: 'customer',
    },
  }).as('getProfile');
  cy.intercept('PATCH', '/api/auth/profile', (req) => {
    req.reply({ statusCode: 200, body: { ...req.body, id: 'user-uuid-5678' } });
  }).as('patchProfile');
});

Cypress.Commands.add('interceptSensors', () => {
  cy.intercept('GET', '/api/sensors', { fixture: 'sensors.json' }).as('getSensors');
});

Cypress.Commands.add('interceptFavourites', () => {
  cy.intercept('GET', '/api/favourites', { fixture: 'mock-favourites.json' }).as('getFavourites');
  cy.intercept('POST', '/api/favourites', (req) => {
    req.reply({
      statusCode: 200,
      body: { nodeId: req.body?.nodeId ?? 'node-uuid-002', favouritedAt: new Date().toISOString() },
    });
  }).as('addFavourite');
  cy.intercept('DELETE', '/api/favourites/*', { statusCode: 204, body: {} }).as('removeFavourite');
});

Cypress.Commands.add('interceptFeed', () => {
  cy.intercept('GET', '/api/posts*', { fixture: 'posts.json' }).as('getPosts');
  cy.intercept('POST', '/api/posts', (req) => {
    req.reply({ statusCode: 200, body: { id: 'new-post-uuid', ...req.body } });
  }).as('createPost');
  cy.intercept('PATCH', '/api/posts/*', (req) => {
    req.reply({ statusCode: 200, body: { id: 'post-uuid-001', ...req.body } });
  }).as('updatePost');
  cy.intercept('DELETE', '/api/posts/*', { statusCode: 204, body: {} }).as('deletePost');
  cy.intercept('POST', '/api/posts/*/like', {
    body: { liked: true, likesCount: 13 },
  }).as('toggleLike');
  cy.intercept('GET', '/api/posts/*/comments*', {
    body: { comments: [], totalTopLevel: 0, page: 0, size: 20 },
  }).as('getComments');
  cy.intercept('POST', '/api/posts/*/comments', (req) => {
    req.reply({ statusCode: 200, body: { id: 'comment-uuid-001', content: req.body?.content ?? '' } });
  }).as('createComment');
});

Cypress.Commands.add('interceptBlogs', () => {
  cy.intercept('GET', '/api/blogs/featured', { fixture: 'blogs.json' }).as('getFeaturedBlogs');
  cy.intercept('GET', '/api/blogs*', { fixture: 'blogs.json' }).as('getBlogs');
  cy.intercept('POST', '/api/blogs', (req) => {
    req.reply({ statusCode: 200, body: { id: 'blog-uuid-new', ...req.body } });
  }).as('createBlog');
  cy.intercept('PATCH', '/api/blogs/*', (req) => {
    req.reply({ statusCode: 200, body: { id: 'blog-uuid-001', ...req.body } });
  }).as('updateBlog');
  cy.intercept('DELETE', '/api/blogs/*', { statusCode: 204, body: {} }).as('deleteBlog');
});

Cypress.Commands.add('interceptGroups', () => {
  cy.intercept('GET', '/api/groups*', { fixture: 'groups.json' }).as('getGroups');
  cy.intercept('GET', '/api/groups/*', {
    body: {
      id: 'group-uuid-001',
      slug: 'flood-alerts-kuching',
      name: 'Flood Alerts Kuching',
      description: 'Real-time flood updates for Kuching area.',
      memberCount: 142,
      isMember: false,
      createdAt: '2025-01-01T00:00:00Z',
    },
  }).as('getGroup');
  cy.intercept('POST', '/api/groups/*/membership', {
    body: { isMember: true, memberCount: 143 },
  }).as('joinGroup');
  cy.intercept('DELETE', '/api/groups/*/membership', {
    body: { isMember: false, memberCount: 142 },
  }).as('leaveGroup');
});

Cypress.Commands.add('interceptApi', (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS',
  path: string,
  fixture: string | object,
  alias: string,
) => {
  if (typeof fixture === 'string') {
    cy.intercept(method, path, { fixture }).as(alias);
  } else {
    cy.intercept(method, path, { body: fixture }).as(alias);
  }
});

// ── Utility commands ──────────────────────────────────────────────────────────

Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('body').should('be.visible');
  cy.document().its('readyState').should('eq', 'complete');
});

// ── Legacy aliases ────────────────────────────────────────────────────────────

Cypress.Commands.add('loginAsUser', () => {
  cy.login();
});

Cypress.Commands.add('loginAs', (email: string, password: string) => {
  cy.login(email, password);
});

export {};
