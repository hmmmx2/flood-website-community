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
    // hands off to NextAuth credentials — stub that callback to succeed.
    cy.intercept('POST', '/api/auth/callback/credentials*', {
      statusCode: 200,
      body: { url: `${Cypress.config('baseUrl')}/` },
    }).as('nextAuthCallback');
    cy.get('#email').type('user@example.com');
    cy.get('#password').type('Password@123');
    cy.cyGet('login-submit').click();
    cy.wait('@loginPost');
    cy.location('pathname').should('eq', '/');
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
