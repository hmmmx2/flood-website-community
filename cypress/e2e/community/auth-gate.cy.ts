/// <reference types="cypress" />

// Route-gating contract (enforced by proxy.ts + auth.config.ts):
//   • /settings  → redirects to /login when unauthenticated
//   • /register  → redirects to /     when authenticated
//   • /           → PUBLIC (anonymous sees a "Join the community" CTA)
// All other routes are client-gated via useSession().

describe('Community · auth gate', () => {
  it('redirects unauthenticated users away from /settings to /login', () => {
    cy.visit('/settings', { failOnStatusCode: false });
    cy.location('pathname').should('eq', '/login');
  });

  it('lets an authenticated user reach /settings (signed session cookie)', () => {
    cy.loginViaMock();
    cy.interceptProfile();
    cy.interceptNotifications();
    cy.visit('/settings');
    cy.location('pathname').should('eq', '/settings');
  });

  it('redirects an authenticated user away from /register to the feed', () => {
    cy.loginViaMock();
    cy.interceptFeed();
    cy.visit('/register');
    cy.location('pathname').should('eq', '/');
  });

  it('serves the home feed publicly to anonymous visitors with a join CTA', () => {
    cy.interceptFeed();
    cy.visit('/');
    cy.contains('a', 'Log In').should('be.visible');
    cy.contains('a', 'Sign Up').should('be.visible');
  });
});
