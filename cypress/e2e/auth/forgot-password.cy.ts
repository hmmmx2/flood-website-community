/**
 * E2E — Auth: Forgot Password & Reset Password
 *
 * Covers:
 *  - Forgot-password form renders
 *  - Valid email submission → confirmation state
 *  - Invalid email → error message
 *  - "Enter Reset Code" link after submission
 *  - Reset-password page renders
 *  - Successful code + new password submission
 *  - Wrong reset code → error
 *  - Back to Sign In link
 */

import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage';

const page = new ForgotPasswordPage();

describe('Forgot Password', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  afterEach(() => {
    cy.clearLocalStorage();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  context('Form rendering', () => {
    it('renders the forgot-password page', () => {
      page.visit();
      page.assertFormVisible();
    });

    it('shows a "Back to Sign In" link', () => {
      page.visit();
      page.backToSignInLink.should('be.visible');
    });

    it('shows the FloodWatch logo', () => {
      page.visit();
      cy.get('img[alt="Logo"]').should('exist');
    });
  });

  // ── Email submission ─────────────────────────────────────────────────────

  context('Email submission', () => {
    it('shows confirmation state after successful email submission', () => {
      // Arrange
      cy.intercept('POST', '/api/auth/forgot-password', {
        statusCode: 200,
        body: { message: 'Reset code sent.' },
      }).as('forgotPassword');

      // Act
      page.visit();
      page.submitEmail('user@example.com');
      cy.wait('@forgotPassword');

      // Assert
      page.assertEmailSent();
    });

    it('shows the submitted email in the confirmation message', () => {
      cy.intercept('POST', '/api/auth/forgot-password', {
        body: { message: 'Reset code sent.' },
      }).as('forgotPassword');

      page.visit();
      page.submitEmail('myemail@example.com');
      cy.wait('@forgotPassword');

      cy.contains('myemail@example.com').should('be.visible');
    });

    it('shows an "Enter Reset Code" button/link after submission', () => {
      cy.intercept('POST', '/api/auth/forgot-password', {
        body: { message: 'Reset code sent.' },
      }).as('forgotPassword');

      page.visit();
      page.submitEmail('user@example.com');
      cy.wait('@forgotPassword');

      page.enterResetCodeLink.should('be.visible');
    });

    it('clicking "Enter Reset Code" navigates to /reset-password', () => {
      cy.intercept('POST', '/api/auth/forgot-password', {
        body: { message: 'Reset code sent.' },
      }).as('forgotPassword');

      page.visit();
      page.submitEmail('user@example.com');
      cy.wait('@forgotPassword');

      page.enterResetCodeLink.click();
      cy.url().should('include', '/reset-password');
    });
  });

  // ── Invalid email ────────────────────────────────────────────────────────

  context('Error states', () => {
    it('shows HTML5 validation for malformed email', () => {
      page.visit();
      page.emailInput.type('notanemail');
      page.submitButton.click();

      page.emailInput.then(($el) => {
        expect(($el[0] as HTMLInputElement).validity.typeMismatch).to.be.true;
      });
    });

    it('shows error message when email is not found (404)', () => {
      cy.intercept('POST', '/api/auth/forgot-password', {
        statusCode: 404,
        body: { error: 'No account found for that email.' },
      }).as('notFound');

      page.visit();
      page.submitEmail('nouser@example.com');
      cy.wait('@notFound');

      cy.contains(/not found|no account|error|failed/i).should('be.visible');
    });

    it('shows error message on 500 server error', () => {
      cy.intercept('POST', '/api/auth/forgot-password', { statusCode: 500 }).as('serverError');

      page.visit();
      page.submitEmail('user@example.com');
      cy.wait('@serverError');

      cy.contains(/error|failed|went wrong/i).should('be.visible');
    });
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  context('Navigation', () => {
    it('navigates to /login when "Back to Sign In" is clicked', () => {
      page.visit();
      page.backToSignInLink.first().click();
      cy.url().should('include', '/login');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Reset Password (/reset-password)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  afterEach(() => {
    cy.clearLocalStorage();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  context('Form rendering', () => {
    it('renders the reset-password page', () => {
      cy.visit('/reset-password');
      cy.get('body').should('be.visible');
      cy.get('input[type="password"]').should('exist');
    });

    it('renders with pre-filled email from query param', () => {
      cy.visit('/reset-password?email=user%40example.com');
      cy.contains('user@example.com').should('exist');
    });
  });

  // ── Successful reset ─────────────────────────────────────────────────────

  context('Successful password reset', () => {
    it('submits the reset form and shows success', () => {
      // Arrange
      cy.intercept('POST', '/api/auth/verify-reset-code', {
        body: { message: 'Code verified.' },
      }).as('verifyCode');
      cy.intercept('POST', '/api/auth/reset-password', {
        body: { message: 'Password reset successfully.' },
      }).as('resetPassword');

      // Act
      cy.visit('/reset-password?email=user%40example.com');

      const page = new ForgotPasswordPage();
      page.submitReset('123456', 'NewPass@123', 'NewPass@123');

      // Assert
      cy.wait('@resetPassword');
      cy.contains(/success|reset|changed/i).should('be.visible');
    });
  });

  // ── Validation ───────────────────────────────────────────────────────────

  context('Reset form validation', () => {
    it('shows error when reset code is invalid', () => {
      cy.intercept('POST', '/api/auth/verify-reset-code', {
        statusCode: 400,
        body: { error: 'Invalid or expired reset code.' },
      }).as('badCode');

      cy.visit('/reset-password?email=user%40example.com');
      const page = new ForgotPasswordPage();
      page.submitReset('000000', 'NewPass@123', 'NewPass@123');
      cy.wait('@badCode');

      cy.contains(/invalid|expired|incorrect/i).should('be.visible');
    });

    it('shows error when new passwords do not match', () => {
      cy.visit('/reset-password?email=user%40example.com');
      const page = new ForgotPasswordPage();
      // Try mismatched passwords (client-side guard)
      page.submitReset('123456', 'NewPass@123', 'DifferentPass@1');

      cy.contains(/do not match|mismatch|passwords/i).should('be.visible');
    });
  });
});
