/// <reference types="cypress" />

describe('Community · login', () => {
  beforeEach(() => {
    cy.interceptAuth();
    cy.visit('/login');
    // Gate on the SessionProvider's session fetch so React has hydrated
    // and event handlers are attached before we type/click.
    cy.wait('@anonSession');
  });

  it('renders the sign-in form with email + password and helper links', () => {
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.cyGet('login-submit').should('contain', 'Sign In');
    cy.contains('button', 'Forgot password?').should('be.visible');
    cy.contains('button', 'Create one').should('be.visible');
  });

  it('toggles password visibility', () => {
    cy.get('#password').type('Secret123');
    cy.get('#password').should('have.attr', 'type', 'password');
    cy.cyGet('login-pw-toggle').click();
    cy.get('#password').should('have.attr', 'type', 'text');
    cy.cyGet('login-pw-toggle').click();
    cy.get('#password').should('have.attr', 'type', 'password');
  });

  it('shows an error banner on invalid credentials', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { error: 'Invalid email or password.', code: 'invalid_credentials' },
    }).as('loginFail');
    cy.get('#email').type('user@example.com');
    cy.get('#password').type('wrongpass');
    cy.cyGet('login-submit').click();
    cy.wait('@loginFail');
    cy.cyGet('login-error').should('contain', 'Invalid email or password.');
    cy.location('pathname').should('eq', '/login');
  });

  it('signs a customer in and routes to the feed on success', () => {
    // /api/auth/login returns a valid customer payload, then the page
    // establishes the NextAuth session via the token-handoff provider
    // (`admin-token`) REUSING those tokens — it no longer re-submits the
    // password through the credentials provider (that doubled the login
    // rate-limiter spend). Stub the admin-token callback to succeed.
    cy.intercept('POST', '/api/auth/callback/admin-token*', {
      statusCode: 200,
      body: { url: `${Cypress.config('baseUrl')}/` },
    }).as('nextAuthCallback');
    cy.get('#email').type('user@example.com');
    cy.get('#password').type('Password@123');
    cy.cyGet('login-submit').click();
    cy.wait('@loginPost');
    cy.location('pathname').should('eq', '/');
  });

  it('does NOT re-submit the password to a second /auth/login (single rate-limiter spend)', () => {
    // Regression guard for the double-login bug: a single sign-in must
    // hit /api/auth/login exactly once. The session is then established
    // from the returned tokens via the admin-token provider, whose
    // callback validates against /profile — not the login limiter.
    let loginCalls = 0;
    cy.intercept('POST', '/api/auth/login', (req) => {
      loginCalls += 1;
      req.reply({ fixture: 'login-response.json' });
    }).as('loginOnce');
    cy.intercept('POST', '/api/auth/callback/admin-token*', {
      statusCode: 200,
      body: { url: `${Cypress.config('baseUrl')}/` },
    }).as('adminTokenCallback');
    cy.get('#email').type('user@example.com');
    cy.get('#password').type('Password@123');
    cy.cyGet('login-submit').click();
    cy.wait('@loginOnce');
    cy.location('pathname').should('eq', '/');
    cy.then(() => {
      expect(loginCalls, 'POST /api/auth/login call count').to.eq(1);
    });
  });

  it('routes an unverified account to /verify-email instead of a dead-end error', () => {
    // Java returns 400 EMAIL_NOT_VERIFIED for a correct password on an
    // unconfirmed account; the BFF normalises it to code
    // `email_not_verified`. The page should re-issue a code and bounce
    // the user to the verification screen — not strand them on a
    // generic "Invalid email or password" banner.
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 400,
      body: {
        error: 'Please verify your email before signing in.',
        code: 'email_not_verified',
      },
    }).as('loginUnverified');
    cy.get('#email').type('pending@example.com');
    cy.get('#password').type('Password@123');
    cy.cyGet('login-submit').click();
    cy.wait('@loginUnverified');
    cy.wait('@resendVerification');
    cy.location('pathname').should('eq', '/verify-email');
    cy.location('search').should('include', 'email=pending%40example.com');
  });

  it('switches to the register view and back', () => {
    cy.contains('button', 'Create one').click();
    cy.contains('h2', 'Create Account').should('be.visible');
    cy.contains('button', 'Sign In').click();
    cy.contains('h2', 'Welcome Back').should('be.visible');
  });

  it('navigates to forgot-password', () => {
    cy.contains('button', 'Forgot password?').click();
    cy.location('pathname').should('eq', '/forgot-password');
  });
});
