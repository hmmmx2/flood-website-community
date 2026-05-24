/// <reference types="cypress" />

// Shared, fully-typed contracts for the Community E2E suite.
// No `any` anywhere — fixtures and intercept bodies are typed against
// the same shapes the app's `lib/types.ts` exposes.

export interface MockSessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

export interface MockSession {
  user: MockSessionUser;
  accessToken: string;
  refreshToken: string;
  expires: string;
}

export interface MockPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  groupId: string | null;
  groupSlug: string | null;
  groupName: string | null;
  title: string;
  content: string;
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: unknown[];
}

export interface MockPagedPosts {
  content: MockPost[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}

export interface MockGroup {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconLetter?: string;
  iconColor?: string;
  membersCount?: number;
  memberCount?: number;
  postsCount?: number;
  postCount?: number;
  joinedByMe?: boolean;
  isMember?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MockBlog {
  id: string;
  title: string;
  body: string;
  category: string;
  imageKey: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockComment {
  id: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  score: number;
  myVote: -1 | 0 | 1;
  createdAt: string;
  updatedAt?: string;
  deleted: boolean;
  replyCount: number;
}

export interface MockCommentsPage {
  comments: MockComment[];
  totalTopLevel: number;
  page: number;
  size: number;
  totalComments: number;
}

/** Options accepted by `cy.loginViaMock()`. */
export interface LoginViaMockOptions {
  /** Fixture path (under cypress/fixtures) for the mocked NextAuth session. */
  fixture?: string;
  /** When true, also mint + set a real signed session cookie so the
   *  middleware (`proxy.ts`) lets SSR-gated routes like /settings through. */
  signCookie?: boolean;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Authenticate the app deterministically with NO backend:
       *  - persistently intercepts `GET /api/auth/session` so client
       *    `useSession()` resolves to an authenticated customer;
       *  - (optionally) mints + sets a valid NextAuth JWT cookie via the
       *    `signSession` node task so the edge middleware lets `/settings`
       *    through instead of bouncing to `/login`.
       * Wrapped in `cy.session(..., { cacheAcrossSpecs: true })`.
       */
      loginViaMock(options?: LoginViaMockOptions): Chainable<void>;

      /** Stub every read-only Community API used by the feed/home. */
      interceptFeed(): Chainable<void>;
      /** Stub blog list + featured + detail endpoints. */
      interceptBlogs(): Chainable<void>;
      /** Stub group list + detail + membership endpoints. */
      interceptGroups(): Chainable<void>;
      /** Stub the user profile + posts-by-user endpoints. */
      interceptProfile(): Chainable<void>;
      /** Stub notification list / preference endpoints. */
      interceptNotifications(): Chainable<void>;
      /** Stub flood-map zones + sensors endpoints. */
      interceptZones(): Chainable<void>;
      /** Stub all auth-mutation endpoints (login/register/verify/reset…). */
      interceptAuth(): Chainable<void>;
      /** Stub the SSE + health endpoints so providers don't spew network noise. */
      stubAmbient(): Chainable<void>;

      /**
       * Generic typed API interceptor.
       * @param method HTTP method
       * @param path   URL glob
       * @param body   Fixture name (string) or inline JSON body (object)
       * @param alias  cy.wait alias (without `@`)
       */
      interceptApi(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path: string,
        body: string | object,
        alias: string,
      ): Chainable<void>;

      /** Select an element by its `data-cy` attribute. */
      cyGet(selector: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

export {};
