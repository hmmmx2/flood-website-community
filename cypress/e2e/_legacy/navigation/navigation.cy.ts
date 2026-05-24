/**
 * E2E — Navigation
 *
 * Covers:
 *  - Navbar brand logo link → home
 *  - Navbar Community link → /
 *  - Navbar Blog link → /blog
 *  - Navbar Flood Map link → /flood-map
 *  - Unauthenticated navbar shows Login + Sign Up
 *  - Authenticated navbar shows user avatar + menu
 *  - User menu → Settings navigates to /settings
 *  - User menu → Sign Out clears localStorage and redirects
 *  - Protected routes redirect to /login when unauthenticated
 *  - 404 not-found page renders for unknown routes
 *  - Back navigation works correctly
 */

describe('Navigation', () => {
  // ── Navbar – unauthenticated ─────────────────────────────────────────────

  context('Navbar — unauthenticated', () => {
    beforeEach(() => {
      cy.interceptBlogs();
      cy.interceptFeed();
      cy.interceptSensors();
      cy.interceptFavourites();
    });

    it('shows Log In and Sign Up buttons', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.contains(/log in/i).should('be.visible');
      cy.contains(/sign up/i).should('be.visible');
    });

    it('navigates to /login when Log In is clicked', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.contains(/log in/i).first().click();
      cy.url().should('include', '/login');
    });

    it('navigates to /register when Sign Up is clicked', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.contains(/sign up/i).first().click();
      cy.url().should('satisfy', (url: string) =>
        url.includes('/register') || url.includes('/login'),
      );
    });
  });

  // ── Navbar – authenticated ───────────────────────────────────────────────

  context('Navbar — authenticated', () => {
    beforeEach(() => {
      cy.seedAuth();
      cy.interceptFeed();
      cy.interceptSensors();
      cy.interceptFavourites();
      cy.interceptBlogs();
    });

    afterEach(() => cy.clearLocalStorage());

    it('shows the user display name in the navbar', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.contains('Community User').should('be.visible');
    });

    it('shows nav links: Community, Blog, Flood Map', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.get('nav, header').contains(/community/i).should('exist');
      cy.get('nav, header').contains(/blog/i).should('exist');
      cy.get('nav, header').contains(/flood map/i).should('exist');
    });

    it('navigates to /blog when Blog link is clicked', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.get('nav a, header a').contains(/^blog$/i).first().click();
      cy.url().should('include', '/blog');
    });

    it('navigates to /flood-map when Flood Map link is clicked', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.get('nav a, header a').contains(/flood map/i).first().click();
      cy.url().should('include', '/flood-map');
    });

    it('navigates to / when Community link is clicked', () => {
      cy.visit('/blog');
      cy.waitForPageLoad();

      cy.get('nav a, header a').contains(/community/i).first().click();
      cy.url().should('satisfy', (url: string) =>
        url.endsWith('/') || !url.includes('/blog'),
      );
    });

    it('opens user dropdown menu on avatar click', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      // Click the user avatar / name button
      cy.get('header button').contains('Community User').click();
      cy.contains(/settings/i).should('be.visible');
      cy.contains(/sign out/i).should('be.visible');
    });

    it('navigates to /settings via user menu', () => {
      cy.interceptProfile();

      cy.visit('/');
      cy.waitForPageLoad();

      cy.get('header button').contains('Community User').click();
      cy.get('a[href="/settings"]').first().click();
      cy.url().should('include', '/settings');
    });

    it('signs out and clears localStorage when Sign Out is clicked', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.get('header button').contains('Community User').click();
      cy.contains(/sign out/i).filter('button').click();

      // Assert localStorage is cleared
      cy.window().then((win) => {
        expect(win.localStorage.getItem('community_access_token')).to.be.null;
        expect(win.localStorage.getItem('community_auth_user')).to.be.null;
      });

      cy.url().should('include', '/login');
    });
  });

  // ── Protected routes ─────────────────────────────────────────────────────

  context('Protected route redirects', () => {
    it('redirects /settings to /login when unauthenticated', () => {
      cy.visit('/settings');
      cy.url().should('include', '/login');
    });

    it('allows unauthenticated access to /blog', () => {
      cy.intercept('GET', '/api/blogs*', { body: { content: [], totalElements: 0 } });
      cy.intercept('GET', '/api/blogs/featured', { body: { content: [] } });

      cy.visit('/blog');
      cy.url().should('not.include', '/login');
      cy.get('body').should('be.visible');
    });

    it('allows unauthenticated access to /login', () => {
      cy.visit('/login');
      cy.url().should('include', '/login');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('allows unauthenticated access to /register', () => {
      cy.visit('/register');
      cy.url().should('include', '/register');
    });

    it('allows unauthenticated access to /forgot-password', () => {
      cy.visit('/forgot-password');
      cy.url().should('include', '/forgot-password');
    });
  });

  // ── 404 page ─────────────────────────────────────────────────────────────

  context('404 Not Found', () => {
    it('renders a 404 page for unknown routes', () => {
      cy.visit('/this-page-does-not-exist-abc123', { failOnStatusCode: false });
      cy.get('body').should('be.visible');
      // Next.js will render either a 404 page or the not-found component
      cy.contains(/not found|404|page.*not exist|doesn't exist/i).should('be.visible');
    });
  });

  // ── Back navigation ──────────────────────────────────────────────────────

  context('Back navigation', () => {
    beforeEach(() => {
      cy.interceptBlogs();
      cy.intercept('GET', '/api/blogs/blog-uuid-001', {
        body: {
          id: 'blog-uuid-001',
          title: 'Understanding Flood Risk in Kuching',
          body: 'Body text.',
          category: 'Education',
          isFeatured: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      }).as('getBlogDetail');
    });

    it('can navigate forward into blog detail and back to list', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains('Understanding Flood Risk in Kuching').click();
      cy.url().should('include', '/blog/');

      cy.go('back');
      cy.url().should('include', '/blog');
    });

    it('uses back link on blog detail to return to blog list', () => {
      cy.visit('/blog/blog-uuid-001');
      cy.wait('@getBlogDetail');
      cy.waitForPageLoad();

      cy.contains(/back|← blog/i).first().click();
      cy.url().should('include', '/blog');
    });
  });

  // ── Logo / brand link ────────────────────────────────────────────────────

  context('Logo navigation', () => {
    beforeEach(() => {
      cy.interceptBlogs();
      cy.interceptFeed();
      cy.interceptSensors();
      cy.interceptFavourites();
    });

    it('clicking the FloodWatch logo returns to home', () => {
      cy.visit('/blog');
      cy.waitForPageLoad();

      cy.get('header a[href="/"]').first().click();
      cy.url().should('satisfy', (url: string) => url.endsWith('/') || !url.includes('/blog'));
    });
  });
});
