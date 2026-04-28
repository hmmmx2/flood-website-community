/**
 * E2E — Settings
 *
 * Covers:
 *  - Unauthenticated redirect to /login
 *  - Profile tab: update name and avatar URL
 *  - Password tab: change password (success)
 *  - Password tab: mismatched passwords error
 *  - Password tab: wrong current password error
 *  - Notifications tab: push toggle renders
 *  - Danger zone tab renders
 *  - Navigation between tabs
 */

import { SettingsPage } from '../../pages/SettingsPage';

const page = new SettingsPage();

describe('Settings', () => {
  // ── Auth guard ───────────────────────────────────────────────────────────

  context('Authentication guard', () => {
    it('redirects to /login when not authenticated', () => {
      // Arrange — no localStorage tokens

      // Act
      cy.visit('/settings');

      // Assert
      cy.url().should('include', '/login');
    });
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  context('Page rendering', () => {
    beforeEach(() => {
      cy.seedAuth();
      cy.interceptProfile();
    });

    afterEach(() => cy.clearLocalStorage());

    it('renders the settings page when authenticated', () => {
      page.visit();
      cy.waitForPageLoad();
      page.assertLoaded();
    });

    it('shows the Profile tab by default', () => {
      page.visit();
      cy.waitForPageLoad();
      cy.contains(/profile/i).should('be.visible');
    });

    it('shows all four tabs (Profile, Password, Notifications, Danger)', () => {
      page.visit();
      cy.waitForPageLoad();

      page.profileTab.should('be.visible');
      page.passwordTab.should('be.visible');
      page.notificationsTab.should('be.visible');
      page.dangerTab.should('be.visible');
    });
  });

  // ── Profile update ───────────────────────────────────────────────────────

  context('Profile tab', () => {
    beforeEach(() => {
      cy.seedAuth();
      cy.interceptProfile();
    });

    afterEach(() => cy.clearLocalStorage());

    it('shows first name and last name inputs', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openProfileTab();

      page.firstNameInput.should('be.visible');
      page.lastNameInput.should('be.visible');
    });

    it('successfully updates the profile', () => {
      cy.intercept('PATCH', '/api/auth/profile', (req) => {
        req.reply({ statusCode: 200, body: { ...req.body, id: 'user-uuid-5678' } });
      }).as('updateProfile');

      page.visit();
      cy.waitForPageLoad();
      page.openProfileTab();

      page.firstNameInput.clear().type('Updated');
      page.lastNameInput.clear().type('Name');
      page.saveProfileButton.click();
      cy.wait('@updateProfile');

      page.profileSuccessMessage.should('be.visible');
    });

    it('shows error when profile update fails', () => {
      cy.intercept('PATCH', '/api/auth/profile', {
        statusCode: 500,
        body: { error: 'Server error.' },
      }).as('failProfile');

      page.visit();
      cy.waitForPageLoad();
      page.openProfileTab();

      page.firstNameInput.clear().type('Test');
      page.lastNameInput.clear().type('Fail');
      page.saveProfileButton.click();
      cy.wait('@failProfile');

      cy.contains(/error|failed|went wrong/i).should('be.visible');
    });

    it('shows an avatar URL input', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openProfileTab();

      page.avatarUrlInput.should('exist');
    });
  });

  // ── Password change ──────────────────────────────────────────────────────

  context('Password tab', () => {
    beforeEach(() => {
      cy.seedAuth();
      cy.interceptProfile();
    });

    afterEach(() => cy.clearLocalStorage());

    it('shows current, new, and confirm password fields', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openPasswordTab();

      page.currentPasswordInput.should('be.visible');
      page.newPasswordInput.should('be.visible');
      page.confirmPasswordInput.should('be.visible');
    });

    it('successfully changes the password', () => {
      cy.intercept('POST', '/api/auth/change-password', {
        statusCode: 200,
        body: { message: 'Password changed successfully.' },
      }).as('changePw');

      page.visit();
      cy.waitForPageLoad();
      page.changePassword('OldPass@123', 'NewPass@456', 'NewPass@456');
      cy.wait('@changePw');

      page.passwordSuccessMessage.should('be.visible');
    });

    it('shows error when new passwords do not match (client-side)', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openPasswordTab();

      page.currentPasswordInput.type('OldPass@123');
      page.newPasswordInput.type('NewPass@456');
      page.confirmPasswordInput.type('DifferentPass@1');
      page.changePasswordButton.click();

      page.passwordErrorMessage.should('be.visible');
    });

    it('shows error when current password is incorrect', () => {
      cy.intercept('POST', '/api/auth/change-password', {
        statusCode: 400,
        body: { error: 'Current password is incorrect.' },
      }).as('wrongPw');

      page.visit();
      cy.waitForPageLoad();
      page.changePassword('WrongOld@1', 'NewPass@456', 'NewPass@456');
      cy.wait('@wrongPw');

      cy.contains(/incorrect|wrong|invalid/i).should('be.visible');
    });

    it('shows error when new password is too short', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openPasswordTab();

      page.currentPasswordInput.type('OldPass@123');
      page.newPasswordInput.type('abc');
      page.confirmPasswordInput.type('abc');
      page.changePasswordButton.click();

      cy.contains(/too short|minimum|at least/i).should('be.visible');
    });
  });

  // ── Notifications tab ────────────────────────────────────────────────────

  context('Notifications tab', () => {
    beforeEach(() => {
      cy.seedAuth();
      cy.interceptProfile();
    });

    afterEach(() => cy.clearLocalStorage());

    it('renders the notifications tab content', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openNotificationsTab();

      cy.contains(/notification|push|alert/i).should('be.visible');
    });

    it('shows push notification toggle button', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openNotificationsTab();

      // Either a toggle button or an "Enable" button
      cy.get('button').filter(':visible').should('exist');
    });
  });

  // ── Danger zone tab ──────────────────────────────────────────────────────

  context('Danger zone tab', () => {
    beforeEach(() => {
      cy.seedAuth();
      cy.interceptProfile();
    });

    afterEach(() => cy.clearLocalStorage());

    it('renders the danger zone tab', () => {
      page.visit();
      cy.waitForPageLoad();
      page.openDangerTab();

      cy.contains(/danger|delete account|warning/i).should('be.visible');
    });
  });

  // ── Tab navigation ───────────────────────────────────────────────────────

  context('Tab navigation', () => {
    beforeEach(() => {
      cy.seedAuth();
      cy.interceptProfile();
    });

    afterEach(() => cy.clearLocalStorage());

    it('switches between tabs without navigating away', () => {
      page.visit();
      cy.waitForPageLoad();

      page.openPasswordTab();
      cy.url().should('include', '/settings');

      page.openNotificationsTab();
      cy.url().should('include', '/settings');

      page.openDangerTab();
      cy.url().should('include', '/settings');

      page.openProfileTab();
      cy.url().should('include', '/settings');
    });
  });
});
