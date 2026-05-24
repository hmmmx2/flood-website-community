/// <reference types="cypress" />

describe('Community · forgot password', () => {
  beforeEach(() => {
    cy.interceptAuth();
    cy.visit('/forgot-password');
    cy.wait('@anonSession');
  });

  it('renders the reset-request form', () => {
    cy.contains('Forgot Password').should('be.visible');
    cy.get('#email').should('be.visible');
    cy.cyGet('forgot-submit').should('contain', 'Send Reset Code');
  });

  it('sends a reset code and shows the confirmation panel', () => {
    cy.get('#email').type('ada@example.com');
    cy.cyGet('forgot-submit').click();
    cy.wait('@forgotPassword').its('request.body').should((body: { email: string }) => {
      expect(body.email).to.eq('ada@example.com');
    });
    cy.cyGet('forgot-sent').should('be.visible');
    cy.contains('Check your email').should('be.visible');
    cy.contains('a', 'Enter Reset Code')
      .should('have.attr', 'href')
      .and('include', '/reset-password?email=');
  });

  it('routes to the reset page from the confirmation panel', () => {
    cy.get('#email').type('ada@example.com');
    cy.cyGet('forgot-submit').click();
    cy.wait('@forgotPassword');
    cy.contains('a', 'Enter Reset Code').click();
    cy.location('pathname').should('eq', '/reset-password');
  });
});
