/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsUser(): Chainable<void>;
      loginAs(email: string, password: string): Chainable<void>;
      interceptAuth(): Chainable<void>;
      interceptSensors(): Chainable<void>;
      interceptFavourites(): Chainable<void>;
      interceptFeed(): Chainable<void>;
      interceptBlogs(): Chainable<void>;
      waitForPageLoad(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('interceptAuth', () => {
  cy.intercept('POST', '/api/auth/login', { fixture: 'login-response.json' }).as('login');
  cy.intercept('POST', '/api/auth/register', { fixture: 'login-response.json' }).as('register');
  cy.intercept('POST', '/api/auth/refresh', { body: { accessToken: 'mock-access-token' } }).as('refresh');
  cy.intercept('POST', '/api/auth/forgot-password', { body: { message: 'Reset code sent' } }).as('forgotPassword');
  cy.intercept('POST', '/api/auth/verify-reset-code', { body: { message: 'Code verified' } }).as('verifyCode');
  cy.intercept('POST', '/api/auth/reset-password', { body: { message: 'Password reset successfully' } }).as('resetPassword');
});

Cypress.Commands.add('loginAsUser', () => {
  cy.interceptAuth();
  cy.interceptSensors();
  cy.interceptFavourites();
  cy.interceptFeed();

  cy.visit('/login');
  cy.get('input[type="email"], input[name="email"]').clear().type(Cypress.env('USER_EMAIL'));
  cy.get('input[type="password"], input[name="password"]').clear().type(Cypress.env('USER_PASSWORD'));
  cy.get('button[type="submit"]').click();
  cy.wait('@login');
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('loginAs', (email: string, password: string) => {
  cy.interceptAuth();
  cy.visit('/login');
  cy.get('input[type="email"], input[name="email"]').clear().type(email);
  cy.get('input[type="password"], input[name="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();
  cy.wait('@login');
});

Cypress.Commands.add('interceptSensors', () => {
  cy.intercept('GET', '/api/sensors', { fixture: 'mock-sensors.json' }).as('getSensors');
});

Cypress.Commands.add('interceptFavourites', () => {
  cy.intercept('GET', '/api/favourites', { fixture: 'mock-favourites.json' }).as('getFavourites');
  cy.intercept('POST', '/api/favourites', (req) => {
    req.reply({ statusCode: 200, body: { nodeId: req.body.nodeId, favouritedAt: new Date().toISOString() } });
  }).as('addFavourite');
  cy.intercept('DELETE', '/api/favourites/*', { statusCode: 204 }).as('removeFavourite');
});

Cypress.Commands.add('interceptFeed', () => {
  cy.intercept('GET', '/api/posts*', { fixture: 'mock-posts.json' }).as('getPosts');
  cy.intercept('POST', '/api/posts', (req) => {
    req.reply({ statusCode: 200, body: { id: 'new-post-id', ...req.body } });
  }).as('createPost');
  cy.intercept('POST', '/api/posts/*/like', { body: { liked: true, count: 5 } }).as('toggleLike');
});

Cypress.Commands.add('interceptBlogs', () => {
  cy.intercept('GET', '/api/blogs*', { fixture: 'mock-blogs.json' }).as('getBlogs');
  cy.intercept('GET', '/api/blogs/featured', { fixture: 'mock-blogs.json' }).as('getFeaturedBlogs');
});

Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('body').should('be.visible');
  cy.document().its('readyState').should('eq', 'complete');
});

export {};
