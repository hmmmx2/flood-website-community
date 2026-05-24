/// <reference types="cypress" />

describe('Community · group page', () => {
  beforeEach(() => {
    cy.loginViaMock();
    cy.interceptFeed();
    cy.interceptGroups();
  });

  it('renders the group banner, stats and posts', () => {
    cy.visit('/g/flood-alerts-kuching');
    cy.wait('@getGroup');
    cy.contains('h1', 'Flood Alerts Kuching').should('be.visible');
    cy.contains('142 members').should('be.visible');
    cy.cyGet('group-join').should('contain', 'Join');
    cy.cyGet('post-card').should('have.length.greaterThan', 0);
  });

  it('joins the community and flips the button to Leave', () => {
    cy.visit('/g/flood-alerts-kuching');
    cy.wait('@getGroup');
    cy.cyGet('group-join').click();
    cy.wait('@joinGroup');
    cy.cyGet('group-join').should('contain', 'Leave');
    cy.contains('Joined community').should('be.visible');
  });

  it('shows a not-found state for an unknown group', () => {
    cy.intercept('GET', '/api/groups/*', { statusCode: 404, body: { error: 'not found' } }).as('getMissingGroup');
    cy.visit('/g/nope');
    cy.wait('@getMissingGroup');
    cy.contains('Community not found').should('be.visible');
  });
});
