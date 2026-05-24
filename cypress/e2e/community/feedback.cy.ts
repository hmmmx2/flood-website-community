/// <reference types="cypress" />

describe('Community · feedback', () => {
  it('prompts anonymous visitors to sign in', () => {
    cy.visit('/feedback');
    cy.wait('@anonSession');
    cy.contains('Help us make FloodWatch better').should('be.visible');
    cy.contains('a', 'Sign in to give feedback')
      .should('have.attr', 'href')
      .and('include', '/login');
  });

  it('renders the UAT survey for an authenticated resident', () => {
    cy.loginViaMock();
    cy.intercept('POST', '/api/surveys/uat', { statusCode: 200, body: { ok: true } }).as('submitSurvey');
    cy.visit('/feedback');
    cy.wait('@session');
    cy.contains('UAT Feedback Survey').should('be.visible');
    cy.contains('button', 'Submit feedback').should('be.visible');
  });
});
