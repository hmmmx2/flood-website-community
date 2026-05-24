/// <reference types="cypress" />

describe('Community · reset password', () => {
  beforeEach(() => {
    cy.interceptAuth();
    cy.visit('/reset-password?email=ada@example.com');
    cy.wait('@anonSession');
  });

  it('starts on the code-verification step with the email prefilled', () => {
    cy.contains('Enter Reset Code').should('be.visible');
    cy.get('input[type="email"]').should('have.value', 'ada@example.com');
    cy.cyGet('reset-code').should('be.visible');
    cy.cyGet('reset-verify-submit').should('contain', 'Verify Code');
  });

  it('advances to the new-password step after verifying the code', () => {
    cy.cyGet('reset-code').type('123456');
    cy.cyGet('reset-verify-submit').click();
    cy.wait('@verifyResetCode');
    cy.contains('New Password').should('be.visible');
    cy.cyGet('reset-new-password').should('be.visible');
    cy.cyGet('reset-confirm-password').should('be.visible');
  });

  it('rejects mismatched new passwords', () => {
    cy.cyGet('reset-code').type('123456');
    cy.cyGet('reset-verify-submit').click();
    cy.wait('@verifyResetCode');
    cy.cyGet('reset-new-password').type('Password@123');
    cy.cyGet('reset-confirm-password').type('Different@123');
    cy.cyGet('reset-submit').click();
    cy.contains('Passwords do not match').should('be.visible');
  });

  it('resets the password and shows the success panel', () => {
    cy.cyGet('reset-code').type('123456');
    cy.cyGet('reset-verify-submit').click();
    cy.wait('@verifyResetCode');
    cy.cyGet('reset-new-password').type('NewPassword@123');
    cy.cyGet('reset-confirm-password').type('NewPassword@123');
    cy.cyGet('reset-submit').click();
    cy.wait('@resetPassword').its('request.body').should((body: { newPassword: string }) => {
      expect(body.newPassword).to.eq('NewPassword@123');
    });
    cy.cyGet('reset-done').should('be.visible');
    cy.contains('Password Reset!').should('be.visible');
  });
});
