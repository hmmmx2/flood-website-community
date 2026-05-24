/**
 * Page Object Model — /forgot-password and /reset-password
 */
export class ForgotPasswordPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  readonly forgotUrl = '/forgot-password';
  readonly resetUrl = '/reset-password';

  // Forgot password form
  get emailInput() {
    return cy.get('#email, input[type="email"]').first();
  }

  get submitButton() {
    return cy.get('button[type="submit"]').first();
  }

  get successMessage() {
    return cy.contains(/check your email|sent|email.*sent/i);
  }

  get errorMessage() {
    return cy.contains(/error|failed|invalid|not found/i);
  }

  get backToSignInLink() {
    return cy.contains(/back to sign in|← back/i);
  }

  get enterResetCodeLink() {
    return cy.contains(/enter reset code/i);
  }

  // Reset password form
  get resetCodeInput() {
    return cy.get('input[name="code"], input[placeholder*="code" i], input[type="text"]').first();
  }

  get newPasswordInput() {
    return cy.get('input[type="password"]').first();
  }

  get confirmNewPasswordInput() {
    return cy.get('input[type="password"]').eq(1);
  }

  get resetSubmitButton() {
    return cy.get('button[type="submit"]').first();
  }

  get resetSuccessMessage() {
    return cy.contains(/reset.*success|password.*reset|success/i);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the forgot-password page. */
  visit(): this {
    cy.visit(this.forgotUrl);
    return this;
  }

  /** Navigate to the reset-password page. */
  visitReset(email?: string): this {
    const url = email
      ? `${this.resetUrl}?email=${encodeURIComponent(email)}`
      : this.resetUrl;
    cy.visit(url);
    return this;
  }

  /** Submit an email to request a reset code. */
  submitEmail(email: string): this {
    this.emailInput.clear().type(email);
    this.submitButton.click();
    return this;
  }

  /** On the reset page, submit code + new passwords. */
  submitReset(code: string, password: string, confirm: string): this {
    this.resetCodeInput.clear().type(code);
    this.newPasswordInput.clear().type(password);
    this.confirmNewPasswordInput.clear().type(confirm);
    this.resetSubmitButton.click();
    return this;
  }

  /** Assert the forgot-password form is visible. */
  assertFormVisible(): this {
    this.emailInput.should('be.visible');
    this.submitButton.should('be.visible');
    return this;
  }

  /** Assert the "check your email" confirmation state is shown. */
  assertEmailSent(): this {
    this.successMessage.should('be.visible');
    return this;
  }
}
