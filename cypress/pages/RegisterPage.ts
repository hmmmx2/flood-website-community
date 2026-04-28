/**
 * Page Object Model — /register
 *
 * Standalone registration page at /register.
 */
export class RegisterPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  readonly url = '/register';

  get firstNameInput() {
    return cy.get('input[placeholder="John"], input[id*="first" i], input[name="firstName"]').first();
  }

  get lastNameInput() {
    return cy.get('input[placeholder="Doe"], input[id*="last" i], input[name="lastName"]').first();
  }

  get emailInput() {
    return cy.get('input[type="email"]').first();
  }

  get passwordInput() {
    return cy.get('input[type="password"]').first();
  }

  get confirmPasswordInput() {
    return cy.get('input[type="password"]').eq(1);
  }

  get submitButton() {
    return cy.get('button[type="submit"]').first();
  }

  get errorBanner() {
    return cy.get('[data-testid="error-banner"]').first();
  }

  get signInLink() {
    return cy.contains(/sign in|log in|already have/i);
  }

  get passwordHint() {
    return cy.contains(/minimum 8|at least 8/i);
  }

  get passwordMismatchHint() {
    return cy.contains(/do not match|mismatch/i);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the standalone register page. */
  visit(): this {
    cy.visit(this.url);
    return this;
  }

  /** Fill all registration fields and submit. */
  register(opts: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirm: string;
  }): this {
    this.firstNameInput.clear().type(opts.firstName);
    this.lastNameInput.clear().type(opts.lastName);
    this.emailInput.clear().type(opts.email);
    this.passwordInput.clear().type(opts.password);
    this.confirmPasswordInput.clear().type(opts.confirm);
    this.submitButton.click();
    return this;
  }

  /** Assert the registration form is visible. */
  assertFormVisible(): this {
    this.firstNameInput.should('be.visible');
    this.emailInput.should('be.visible');
    this.passwordInput.should('be.visible');
    this.submitButton.should('be.visible');
    return this;
  }

  /** Assert an error message matching the pattern is displayed. */
  assertError(pattern: string | RegExp): this {
    cy.contains(pattern).should('be.visible');
    return this;
  }

  /** Assert successful redirect away from /register. */
  assertRedirected(): this {
    cy.url().should('not.include', '/register');
    return this;
  }
}
