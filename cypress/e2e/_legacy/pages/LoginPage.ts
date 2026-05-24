/**
 * Page Object Model — /login
 *
 * The login page hosts both the Login and Register views in a single
 * client component with a view toggle.  Methods are fully chainable.
 */
export class LoginPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  readonly url = '/login';

  get emailInput() {
    return cy.get('#email, input[type="email"]').first();
  }

  get passwordInput() {
    return cy.get('#password, input[type="password"]').first();
  }

  get submitButton() {
    return cy.get('button[type="submit"]').first();
  }

  get errorMessage() {
    return cy.get('[data-testid="error-message"], .error-message').first();
  }

  get errorBanner() {
    // The login page renders errors inside a styled div
    return cy.contains(/invalid|incorrect|failed|wrong|unauthori/i);
  }

  get forgotPasswordLink() {
    return cy.get('button, a').contains(/forgot.?password/i).first();
  }

  get rememberMeCheckbox() {
    return cy.get('input[type="checkbox"]').first();
  }

  get createAccountLink() {
    return cy.contains(/create one|sign up|register/i);
  }

  get registerFirstName() {
    return cy.get('input[placeholder="John"], input[type="text"]').first();
  }

  get registerLastName() {
    return cy.get('input[placeholder="Doe"], input[type="text"]').eq(1);
  }

  get registerEmail() {
    return cy.get('input[type="email"]').first();
  }

  get registerPassword() {
    return cy.get('input[type="password"]').first();
  }

  get registerConfirmPassword() {
    return cy.get('input[type="password"]').eq(1);
  }

  get backToSignInLink() {
    return cy.contains(/already have|sign in/i);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the login page. */
  visit(): this {
    cy.visit(this.url);
    return this;
  }

  /** Fill and submit the login form. */
  login(email: string, password: string): this {
    this.emailInput.clear().type(email);
    this.passwordInput.clear().type(password);
    this.submitButton.click();
    return this;
  }

  /** Toggle to the register view inside the login page. */
  goToRegisterView(): this {
    this.createAccountLink.click();
    return this;
  }

  /** Fill and submit the registration form (on the register view). */
  register(firstName: string, lastName: string, email: string, password: string, confirm: string): this {
    this.registerFirstName.clear().type(firstName);
    this.registerLastName.clear().type(lastName);
    this.registerEmail.clear().type(email);
    this.registerPassword.clear().type(password);
    this.registerConfirmPassword.clear().type(confirm);
    cy.get('button[type="submit"]').first().click();
    return this;
  }

  /** Click the Forgot Password button/link. */
  clickForgotPassword(): this {
    this.forgotPasswordLink.click();
    return this;
  }

  /** Assert the login form is visible. */
  assertFormVisible(): this {
    this.emailInput.should('be.visible');
    this.passwordInput.should('be.visible');
    this.submitButton.should('be.visible');
    return this;
  }

  /** Assert an error message is displayed. */
  assertError(pattern: string | RegExp): this {
    cy.contains(pattern).should('be.visible');
    return this;
  }
}
