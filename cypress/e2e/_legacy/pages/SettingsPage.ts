/**
 * Page Object Model — /settings
 *
 * The settings page uses four tabs: Profile, Password, Notifications, Danger Zone.
 */
export class SettingsPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  readonly url = '/settings';

  // Tab navigation
  get profileTab() {
    return cy.contains(/profile/i).filter('button, [role="tab"]').first();
  }

  get passwordTab() {
    return cy.contains(/password/i).filter('button, [role="tab"]').first();
  }

  get notificationsTab() {
    return cy.contains(/notification/i).filter('button, [role="tab"]').first();
  }

  get dangerTab() {
    return cy.contains(/danger|account/i).filter('button, [role="tab"]').first();
  }

  // Profile tab inputs
  get firstNameInput() {
    return cy.get('input[id*="first" i], input[name="firstName"], input[placeholder*="first" i]').first();
  }

  get lastNameInput() {
    return cy.get('input[id*="last" i], input[name="lastName"], input[placeholder*="last" i]').first();
  }

  get avatarUrlInput() {
    return cy.get('input[id*="avatar" i], input[name="avatarUrl"], input[placeholder*="avatar" i]').first();
  }

  get saveProfileButton() {
    return cy.get('button[type="submit"]').filter(':visible').first();
  }

  get profileSuccessMessage() {
    return cy.contains(/saved|updated|success/i);
  }

  // Password tab inputs
  get currentPasswordInput() {
    return cy.get('input[type="password"]').eq(0);
  }

  get newPasswordInput() {
    return cy.get('input[type="password"]').eq(1);
  }

  get confirmPasswordInput() {
    return cy.get('input[type="password"]').eq(2);
  }

  get changePasswordButton() {
    return cy.get('button[type="submit"]').filter(':visible').first();
  }

  get passwordSuccessMessage() {
    return cy.contains(/changed|updated|success/i);
  }

  get passwordErrorMessage() {
    return cy.contains(/error|incorrect|failed|mismatch/i);
  }

  // Notifications tab
  get pushToggleButton() {
    return cy.contains(/enable|disable|push/i).filter('button').first();
  }

  get notificationStatusMessage() {
    return cy.contains(/enabled|disabled|push/i);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the settings page. */
  visit(): this {
    cy.visit(this.url);
    return this;
  }

  /** Switch to the Profile tab. */
  openProfileTab(): this {
    this.profileTab.click();
    return this;
  }

  /** Switch to the Password tab. */
  openPasswordTab(): this {
    this.passwordTab.click();
    return this;
  }

  /** Switch to the Notifications tab. */
  openNotificationsTab(): this {
    this.notificationsTab.click();
    return this;
  }

  /** Switch to the Danger Zone tab. */
  openDangerTab(): this {
    this.dangerTab.click();
    return this;
  }

  /**
   * Fill and submit the profile form.
   * @param firstName First name value
   * @param lastName  Last name value
   */
  updateProfile(firstName: string, lastName: string): this {
    this.openProfileTab();
    this.firstNameInput.clear().type(firstName);
    this.lastNameInput.clear().type(lastName);
    this.saveProfileButton.click();
    return this;
  }

  /**
   * Fill and submit the change-password form.
   */
  changePassword(current: string, newPw: string, confirm: string): this {
    this.openPasswordTab();
    this.currentPasswordInput.clear().type(current);
    this.newPasswordInput.clear().type(newPw);
    this.confirmPasswordInput.clear().type(confirm);
    this.changePasswordButton.click();
    return this;
  }

  /** Assert the settings page loaded (not redirected to login). */
  assertLoaded(): this {
    cy.url().should('include', '/settings');
    cy.get('body').should('be.visible');
    return this;
  }
}
