/**
 * E2E — Auth: Registration
 *
 * Covers (standalone /register route):
 *  - Form renders correctly
 *  - Password length validation
 *  - Password confirmation mismatch
 *  - Duplicate email → error
 *  - Successful registration → session saved + redirect
 *  - Email format validation
 *  - Back link to login
 */

import { RegisterPage } from '../../pages/RegisterPage';

const page = new RegisterPage();

describe('Registration (/register)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  afterEach(() => {
    cy.clearLocalStorage();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  context('Form rendering', () => {
    it('renders all registration fields', () => {
      page.visit();
      page.assertFormVisible();
    });

    it('shows a minimum 8 character hint for password', () => {
      page.visit();
      cy.contains(/minimum 8|at least 8/i).should('be.visible');
    });

    it('shows a link back to the login page', () => {
      page.visit();
      page.signInLink.should('be.visible');
    });
  });

  // ── Validation ───────────────────────────────────────────────────────────

  context('Field validation', () => {
    it('shows password-too-short error when < 8 characters', () => {
      // Arrange
      cy.intercept('POST', '/api/auth/register', {}).as('register');
      page.visit();

      // Act — submit with short password (client-side guard)
      page.register({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'abc',
        confirm: 'abc',
      });

      // Assert — client-side error before network call
      page.assertError(/at least 8|minimum 8|password.*short/i);
    });

    it('shows mismatch error when passwords do not match', () => {
      page.visit();

      page.register({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password@123',
        confirm: 'DifferentPass@1',
      });

      page.assertError(/do not match|mismatch|passwords.*match/i);
    });

    it('shows HTML5 email format validation', () => {
      page.visit();
      page.emailInput.type('notanemail');
      page.submitButton.click();

      page.emailInput.then(($el) => {
        expect(($el[0] as HTMLInputElement).validity.typeMismatch).to.be.true;
      });
    });

    it('requires the first name field (HTML5 required)', () => {
      page.visit();
      page.submitButton.click();
      page.firstNameInput.then(($el) => {
        expect(($el[0] as HTMLInputElement).validity.valueMissing).to.be.true;
      });
    });
  });

  // ── Error states ─────────────────────────────────────────────────────────

  context('API errors', () => {
    it('shows error when email is already registered', () => {
      // Arrange
      cy.intercept('POST', '/api/auth/register', {
        statusCode: 409,
        body: { error: 'Email already registered.' },
      }).as('duplicateEmail');

      page.visit();

      // Act
      page.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@example.com',
        password: 'Password@123',
        confirm: 'Password@123',
      });
      cy.wait('@duplicateEmail');

      // Assert
      cy.contains(/already|registered|exists|taken/i).should('be.visible');
      cy.url().should('include', '/register');
    });

    it('shows generic error on 500 response', () => {
      cy.intercept('POST', '/api/auth/register', { statusCode: 500 }).as('serverError');

      page.visit();
      page.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@example.com',
        password: 'Password@123',
        confirm: 'Password@123',
      });
      cy.wait('@serverError');

      cy.contains(/failed|error|something went wrong/i).should('be.visible');
    });
  });

  // ── Successful registration ───────────────────────────────────────────────

  context('Successful registration', () => {
    it('saves session to localStorage after registration', () => {
      // Arrange
      cy.intercept('POST', '/api/auth/register', { fixture: 'auth.json' }).as('registerPost');
      cy.interceptFeed();

      // Act
      page.visit();
      page.register({
        firstName: 'New',
        lastName: 'Member',
        email: 'new@example.com',
        password: 'Password@123',
        confirm: 'Password@123',
      });
      cy.wait('@registerPost');

      // Assert
      cy.window().then((win) => {
        expect(win.localStorage.getItem('community_access_token')).to.exist;
        expect(win.localStorage.getItem('community_refresh_token')).to.exist;
      });
    });

    it('redirects to home feed after successful registration', () => {
      cy.intercept('POST', '/api/auth/register', { fixture: 'auth.json' }).as('registerPost');
      cy.interceptFeed();

      page.visit();
      page.register({
        firstName: 'New',
        lastName: 'Member',
        email: 'new@example.com',
        password: 'Password@123',
        confirm: 'Password@123',
      });
      cy.wait('@registerPost');

      page.assertRedirected();
    });
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  context('Navigation', () => {
    it('navigates to login page via Sign In link', () => {
      page.visit();
      page.signInLink.click();
      cy.url().should('include', '/login');
    });
  });

  // ── Register view inside /login ───────────────────────────────────────────

  context('Register view inside /login toggle', () => {
    it('shows register form when "Create one" is clicked on /login', () => {
      cy.visit('/login');
      cy.contains(/create one|sign up|register/i).first().click();
      cy.get('input[placeholder="John"]').should('be.visible');
    });

    it('registers and redirects from login-page register view', () => {
      cy.intercept('POST', '/api/auth/register', { fixture: 'auth.json' }).as('registerInLogin');
      cy.interceptFeed();

      cy.visit('/login');
      cy.contains(/create one|sign up/i).first().click();

      cy.get('input[placeholder="John"]').first().type('Test');
      cy.get('input[placeholder="Doe"]').first().type('User');
      cy.get('input[type="email"]').first().type('test@example.com');
      cy.get('input[type="password"]').first().type('Password@123');
      cy.get('input[type="password"]').eq(1).type('Password@123');
      cy.get('button[type="submit"]').first().click();
      cy.wait('@registerInLogin');
      cy.url().should('not.include', '/login');
    });
  });
});
