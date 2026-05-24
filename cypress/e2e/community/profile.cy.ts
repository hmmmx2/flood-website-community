/// <reference types="cypress" />

describe('Community · user profile', () => {
  beforeEach(() => {
    cy.loginViaMock();
    cy.interceptFeed();
    cy.interceptProfile();
  });

  it("renders the viewer's own profile with the edit affordance", () => {
    const myId = Cypress.env('MOCK_USER_ID') as string;
    cy.visit(`/u/${myId}`);
    cy.wait('@getUser');
    cy.wait('@getUserPosts');
    cy.contains('h1', 'Community User').should('be.visible');
    cy.contains('3').should('be.visible'); // post count
    cy.contains('h2', 'Your posts').should('be.visible');
    cy.contains('a', 'Edit profile').should('have.attr', 'href', '/settings');
    cy.cyGet('post-card').should('have.length.greaterThan', 0);
  });

  it("renders another member's profile without the edit affordance", () => {
    cy.visit('/u/some-other-user-id');
    cy.wait('@getUser');
    cy.contains('h2', 'Posts by Community User').should('be.visible');
    cy.contains('a', 'Edit profile').should('not.exist');
  });

  it('shows a not-found state for a missing user', () => {
    cy.intercept('GET', '/api/users/*', { statusCode: 404, body: { error: 'User not found' } }).as('getMissingUser');
    cy.visit('/u/ghost');
    cy.wait('@getMissingUser');
    cy.contains('User not found').should('be.visible');
  });
});
