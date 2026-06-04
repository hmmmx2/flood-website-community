/// <reference types="cypress" />

function typeCode(code: string): void {
  code.split('').forEach((digit, i) => {
    cy.get(`input[aria-label="Digit ${i + 1}"]`).type(digit);
  });
}

describe('Community · verify email', () => {
  beforeEach(() => {
    cy.interceptAuth();
    cy.visit('/verify-email?email=ada@example.com');
    cy.wait('@anonSession');
  });

  it('renders six OTP boxes and the target email', () => {
    cy.contains('Verify your email').should('be.visible');
    cy.contains('ada@example.com').should('be.visible');
    cy.get('input[aria-label^="Digit "]').should('have.length', 6);
    cy.cyGet('verify-submit').should('be.disabled');
  });

  it('enables the verify button once all six digits are entered', () => {
    typeCode('123456');
    cy.cyGet('verify-submit').should('not.be.disabled');
  });

  it('verifies the code and proceeds to sign-in', () => {
    typeCode('123456');
    cy.cyGet('verify-submit').click();
    cy.wait('@verifyEmail').its('request.body').should((body: { email: string; code: string }) => {
      expect(body.code).to.eq('123456');
      expect(body.email).to.eq('ada@example.com');
    });
    cy.contains('Verified').should('be.visible');
    cy.location('pathname', { timeout: 8000 }).should('eq', '/login');
  });

  it('shows the expired-code message on a 410 and stays on the page', () => {
    cy.intercept('POST', '/api/auth/verify-email', {
      statusCode: 410,
      body: { error: 'This verification code has expired. Request a new one from the sign-in page.' },
    }).as('verifyExpired');
    typeCode('123456');
    cy.cyGet('verify-submit').click();
    cy.wait('@verifyExpired');
    cy.contains('expired').should('be.visible');
    cy.location('pathname').should('eq', '/verify-email');
  });

  it('resends a fresh verification code', () => {
    cy.cyGet('verify-resend').click();
    cy.wait('@resendVerification');
    cy.contains('A fresh code has been sent').should('be.visible');
    cy.cyGet('verify-resend').should('be.disabled');
  });
});
