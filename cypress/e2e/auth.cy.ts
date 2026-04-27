/**
 * Community Website — Authentication E2E Tests
 * Covers: login, register, logout, forgot password, protected routes
 */
describe('Authentication', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Login', () => {
    it('renders the login form', () => {
      cy.visit('/login');
      cy.get('input[type="email"], input[name="email"]').should('be.visible');
      cy.get('input[type="password"], input[name="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('shows HTML5 validation on empty submit', () => {
      cy.visit('/login');
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"]').then(($input) => {
        expect(($input[0] as HTMLInputElement).validity.valueMissing).to.be.true;
      });
    });

    it('shows validation error for malformed email', () => {
      cy.visit('/login');
      cy.get('input[type="email"]').type('notanemail');
      cy.get('input[type="password"]').type('Password@123');
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"]').then(($input) => {
        expect(($input[0] as HTMLInputElement).validity.typeMismatch).to.be.true;
      });
    });

    it('shows error toast/message on invalid credentials', () => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 401,
        body: { message: 'Invalid credentials' },
      }).as('failedLogin');

      cy.visit('/login');
      cy.get('input[type="email"]').type('wrong@example.com');
      cy.get('input[type="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();
      cy.wait('@failedLogin');

      cy.contains(/invalid|incorrect|unauthori|wrong/i).should('be.visible');
      cy.url().should('include', '/login');
    });

    it('successfully logs in and navigates to home', () => {
      cy.interceptAuth();
      cy.interceptFeed();
      cy.interceptSensors();
      cy.interceptFavourites();

      cy.visit('/login');
      cy.get('input[type="email"]').type(Cypress.env('USER_EMAIL'));
      cy.get('input[type="password"]').type(Cypress.env('USER_PASSWORD'));
      cy.get('button[type="submit"]').click();
      cy.wait('@login');
      cy.url().should('not.include', '/login');
    });
  });

  describe('Registration', () => {
    it('renders a link to the register page', () => {
      cy.visit('/login');
      cy.get('a').contains(/register|sign up|create account/i).should('be.visible');
    });

    it('renders the registration form', () => {
      cy.intercept('GET', '/api/auth/register*', {}).as('registerPage');
      cy.visit('/login');
      cy.get('a').contains(/register|sign up|create account/i).click();
      cy.get('input[name="firstName"], input[placeholder*="first" i]').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
    });

    it('registers successfully and redirects', () => {
      cy.interceptAuth();
      cy.interceptFeed();

      cy.visit('/login');
      cy.get('a').contains(/register|sign up/i).click();

      cy.get('input[name="firstName"], input[placeholder*="first" i]').first().type('Test');
      cy.get('input[name="lastName"], input[placeholder*="last" i]').first().type('User');
      cy.get('input[type="email"]').type('newuser@example.com');
      cy.get('input[type="password"]').first().type('Password@123');

      cy.get('button[type="submit"]').click();
      cy.wait('@register');
      cy.url().should('not.include', '/login');
    });
  });

  describe('Forgot password', () => {
    it('has a forgot password link on login page', () => {
      cy.visit('/login');
      cy.get('a, button').contains(/forgot|reset password/i).should('be.visible');
    });

    it('renders the forgot password form', () => {
      cy.visit('/login');
      cy.get('a, button').contains(/forgot|reset password/i).click();
      cy.get('input[type="email"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('submits forgot password and shows confirmation', () => {
      cy.interceptAuth();
      cy.visit('/login');
      cy.get('a, button').contains(/forgot|reset password/i).click();
      cy.get('input[type="email"]').type('user@example.com');
      cy.get('button[type="submit"]').click();
      cy.wait('@forgotPassword');
      cy.contains(/sent|email|check/i).should('be.visible');
    });
  });

  describe('Protected routes', () => {
    it('redirects unauthenticated users from settings to login', () => {
      cy.visit('/settings');
      cy.url().should('include', '/login');
    });

    it('allows public access to blog listing', () => {
      cy.intercept('GET', '/api/blogs*', { fixture: 'mock-blogs.json' });
      cy.visit('/blog');
      cy.get('body').should('be.visible');
      cy.url().should('not.include', '/login');
    });
  });
});
