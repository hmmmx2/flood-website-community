/// <reference types="cypress" />

import type { LoginViaMockOptions, MockSession } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Authentication — fully mocked, no backend.
//
// The Community app authenticates via NextAuth (Auth.js v5):
//   • client gating  → `useSession()` fetches `GET /api/auth/session`
//   • SSR/edge gating → `proxy.ts` middleware decodes the session cookie
//
// `loginViaMock` satisfies BOTH layers:
//   1. intercepts `GET /api/auth/session` so `useSession()` is authed;
//   2. mints a real signed JWT cookie via the `signSession` node task so the
//      middleware lets SSR-gated routes (e.g. `/settings`) through.
// The cookie step is cached across specs via `cy.session`.
// ─────────────────────────────────────────────────────────────────────────────

Cypress.Commands.add('loginViaMock', (options: LoginViaMockOptions = {}) => {
  const fixture = options.fixture ?? 'auth/session-user.json';
  const signCookie = options.signCookie ?? true;
  const cookieName = Cypress.env('SESSION_COOKIE') as string;

  if (signCookie) {
    cy.session(
      ['mock-user', fixture],
      () => {
        cy.fixture(fixture).then((session: MockSession) => {
          const nowSec = Math.floor(Date.now() / 1000);
          cy.task<string | null>('signSession', {
            salt: cookieName,
            token: {
              name: session.user.name,
              email: session.user.email,
              picture: session.user.image,
              sub: session.user.id,
              role: session.user.role,
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
              accessTokenExpires: Date.now() + 15 * 60 * 1000,
              iat: nowSec,
            },
          }).then((token) => {
            if (typeof token === 'string' && token.length > 0) {
              cy.setCookie(cookieName, token, {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
              });
            }
          });
        });
      },
      { cacheAcrossSpecs: true },
    );
  }

  // Per-test: make the client-side session resolve authed. Registered
  // after `cy.session`, so it wins over the ambient empty-session stub.
  cy.intercept('GET', '/api/auth/session', { fixture }).as('session');
});

// ─────────────────────────────────────────────────────────────────────────────
// Ambient stubs — keep providers quiet + deterministic on every page.
// ─────────────────────────────────────────────────────────────────────────────

Cypress.Commands.add('stubAmbient', () => {
  cy.intercept('GET', '/api/health', { body: { status: 'ok' } }).as('health');
  // SSE streams consumed by IoTEventProvider + NotificationBell — open + idle.
  cy.intercept('GET', '/api/sse/iot-events', {
    statusCode: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: ':ok\n\n',
  }).as('sseIot');
  cy.intercept('GET', '/api/sse/notifications', {
    statusCode: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: ':ok\n\n',
  }).as('sseNotif');
  // NotificationBell polls these on every authed page — quiet defaults.
  cy.intercept('GET', '/api/notifications/unread-count', { body: { count: 0 } }).as('unreadCount');
  cy.intercept('GET', '/api/notifications*', {
    body: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, last: true },
  }).as('ambientNotifications');
  // Default to UNAUTHENTICATED. NextAuth represents "no session" as JSON
  // `null` (an empty object `{}` is treated as a truthy session by pages
  // that gate on `!session`, e.g. /feedback). `loginViaMock` overrides
  // this per-test with the authenticated fixture.
  cy.intercept('GET', '/api/auth/session', {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: null,
  }).as('anonSession');
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-domain API intercepts.
// ─────────────────────────────────────────────────────────────────────────────

Cypress.Commands.add('interceptFeed', () => {
  cy.intercept('GET', '/api/posts*', { fixture: 'posts.json' }).as('getPosts');
  cy.intercept('POST', '/api/posts', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        id: 'new-post-uuid',
        authorId: Cypress.env('MOCK_USER_ID'),
        authorName: 'Community User',
        authorAvatar: null,
        groupId: null,
        groupSlug: null,
        groupName: null,
        title: (req.body as { title?: string })?.title ?? 'New post',
        content: (req.body as { content?: string })?.content ?? '',
        imageUrl: (req.body as { imageUrl?: string })?.imageUrl ?? null,
        likesCount: 0,
        commentsCount: 0,
        likedByMe: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }).as('createPost');
  cy.intercept('PATCH', '/api/posts/*', (req) => {
    req.reply({ statusCode: 200, body: { id: 'post-uuid-001', ...(req.body as object) } });
  }).as('updatePost');
  cy.intercept('DELETE', '/api/posts/*', { statusCode: 204, body: {} }).as('deletePost');
  cy.intercept('POST', '/api/posts/*/like', { body: { liked: true, likesCount: 13 } }).as('likePost');
  cy.intercept('GET', '/api/posts/*/comments*', {
    body: { comments: [], totalTopLevel: 0, page: 0, size: 20, totalComments: 0 },
  }).as('getComments');
  cy.intercept('POST', '/api/posts/*/comments', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        id: 'comment-uuid-new',
        parentId: null,
        authorId: Cypress.env('MOCK_USER_ID'),
        authorName: 'Community User',
        content: (req.body as { content?: string })?.content ?? '',
        score: 1,
        myVote: 1,
        createdAt: new Date().toISOString(),
        deleted: false,
        replyCount: 0,
      },
    });
  }).as('createComment');
  // Sidebar "Communities" — the home feed expects a bare ARRAY here.
  cy.intercept('GET', '/api/groups', { fixture: 'groups-array.json' }).as('getSidebarGroups');
});

Cypress.Commands.add('interceptBlogs', () => {
  // Registration order matters — Cypress matches the most-recently-defined
  // intercept first. Generic list first, detail glob next, then the exact
  // /featured + /categories routes LAST so they win over the detail glob.
  cy.intercept('GET', '/api/blogs*', { fixture: 'blogs.json' }).as('getBlogs');
  cy.intercept('GET', '/api/blogs/*', { fixture: 'blog-detail.json' }).as('getBlog');
  cy.intercept('GET', '/api/blogs/featured', { fixture: 'blogs-featured.json' }).as('getFeatured');
  cy.intercept('GET', '/api/blogs/categories', {
    body: ['General', 'Flood Alert', 'Safety Tips', 'Community', 'Updates', 'Research'],
  }).as('getCategories');
});

Cypress.Commands.add('interceptGroups', () => {
  cy.intercept('GET', '/api/groups/*/posts*', { fixture: 'posts.json' }).as('getGroupPosts');
  cy.intercept('GET', '/api/groups/*', { fixture: 'group-detail.json' }).as('getGroup');
  // The group page replaces its state with the POST response, so it must be a
  // full Group object (joined).
  cy.intercept('POST', '/api/groups/*/membership', {
    body: {
      id: 'group-uuid-001',
      slug: 'flood-alerts-kuching',
      name: 'Flood Alerts Kuching',
      description: 'Real-time flood updates and community alerts for the Kuching area.',
      iconLetter: 'F',
      iconColor: '#2563eb',
      membersCount: 143,
      postsCount: 28,
      joinedByMe: true,
      createdAt: '2025-01-01T00:00:00Z',
    },
  }).as('joinGroup');
  cy.intercept('DELETE', '/api/groups/*/membership', { statusCode: 204, body: {} }).as('leaveGroup');
});

Cypress.Commands.add('interceptProfile', () => {
  cy.intercept('GET', '/api/auth/profile', { fixture: 'profile.json' }).as('getProfile');
  cy.intercept('PATCH', '/api/auth/profile', (req) => {
    req.reply({ statusCode: 200, body: { id: Cypress.env('MOCK_USER_ID'), ...(req.body as object) } });
  }).as('patchProfile');
  cy.intercept('POST', '/api/auth/change-password', { body: { message: 'Password changed successfully.' } }).as('changePassword');
  // Public profile route (/u/[id]) — user + their posts.
  cy.intercept('GET', '/api/users/*/posts*', { fixture: 'posts.json' }).as('getUserPosts');
  cy.intercept('GET', '/api/users/*', { fixture: 'user-profile.json' }).as('getUser');
});

Cypress.Commands.add('interceptNotifications', () => {
  cy.intercept('GET', '/api/notifications*', { fixture: 'notifications.json' }).as('getNotifications');
  cy.intercept('PATCH', '/api/notifications/*', { statusCode: 200, body: {} }).as('patchNotification');
  cy.intercept('GET', '/api/notification-preferences*', { fixture: 'notification-preferences.json' }).as('getNotifPrefs');
  cy.intercept('PUT', '/api/notification-preferences*', (req) => {
    req.reply({ statusCode: 200, body: req.body as object });
  }).as('putNotifPrefs');
});

Cypress.Commands.add('interceptZones', () => {
  cy.intercept('GET', '/api/zones*', { fixture: 'zones.json' }).as('getZones');
  cy.intercept('GET', '/api/sensors*', { fixture: 'sensors.json' }).as('getSensors');
});

Cypress.Commands.add('interceptAuth', () => {
  cy.intercept('POST', '/api/auth/login', { fixture: 'login-response.json' }).as('loginPost');
  cy.intercept('POST', '/api/auth/register', { body: { email: 'newuser@example.com' } }).as('registerPost');
  cy.intercept('POST', '/api/auth/resend-verification', { body: { message: 'Code resent.' } }).as('resendVerification');
  cy.intercept('POST', '/api/auth/verify-email', { body: { message: 'Email verified.' } }).as('verifyEmail');
  cy.intercept('POST', '/api/auth/forgot-password', { body: { message: 'Reset code sent to your email.' } }).as('forgotPassword');
  cy.intercept('POST', '/api/auth/verify-reset-code', { body: { message: 'Code verified.' } }).as('verifyResetCode');
  cy.intercept('POST', '/api/auth/reset-password', { body: { message: 'Password reset successfully.' } }).as('resetPassword');
  cy.intercept('GET', '/api/auth/crm-url', { body: { url: 'http://localhost:3000' } }).as('crmUrl');
});

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers.
// ─────────────────────────────────────────────────────────────────────────────

Cypress.Commands.add(
  'interceptApi',
  (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body: string | object,
    alias: string,
  ) => {
    if (typeof body === 'string') {
      cy.intercept(method, path, { fixture: body }).as(alias);
    } else {
      cy.intercept(method, path, { body }).as(alias);
    }
  },
);

Cypress.Commands.add('cyGet', (selector: string) => {
  return cy.get(`[data-cy="${selector}"]`);
});

export {};
