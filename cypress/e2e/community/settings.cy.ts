/// <reference types="cypress" />

describe('Community · settings', () => {
  beforeEach(() => {
    cy.loginViaMock();
    cy.interceptProfile();
    // Channel preferences (loaded on mount, saved on toggle).
    cy.intercept('GET', '/api/profile/notification-prefs', {
      body: { phoneE164: '', notifyEmail: true, notifySms: false, notifyWhatsapp: false, notifyInApp: true },
    }).as('getPrefs');
    cy.intercept('PATCH', '/api/profile/notification-prefs', (req) => {
      req.reply({ statusCode: 200, body: req.body as object });
    }).as('patchPrefs');
    // next-auth session.update() POSTs back to the session endpoint.
    cy.intercept('POST', '/api/auth/session', { fixture: 'auth/session-user.json' }).as('updateSession');

    cy.visit('/settings');
    cy.wait('@session');
    cy.wait('@getPrefs');
  });

  it('defaults to the Profile tab with the name fields populated', () => {
    cy.contains('h2', 'Profile Information').should('be.visible');
    cy.cyGet('settings-first-name').should('have.value', 'Community');
    cy.cyGet('settings-last-name').should('have.value', 'User');
    cy.get('input[type="email"]').should('have.value', 'user@example.com').and('be.disabled');
  });

  it('saves profile changes', () => {
    cy.cyGet('settings-first-name').clear().type('Updated');
    cy.cyGet('settings-profile-save').click();
    cy.wait('@patchProfile').its('request.body').should((b: { firstName: string }) => {
      expect(b.firstName).to.eq('Updated');
    });
    cy.contains('Profile updated successfully').should('be.visible');
  });

  it('validates and changes the password', () => {
    cy.cyGet('settings-tab-password').click();
    cy.contains('h2', 'Change Password').should('be.visible');
    // Mismatch surfaces inline.
    cy.cyGet('settings-current-pw').type('OldPass@123');
    cy.cyGet('settings-new-pw').type('NewPass@123');
    cy.cyGet('settings-confirm-pw').type('Different@123');
    cy.contains('Passwords do not match').should('be.visible');
    // Correct it and submit.
    cy.cyGet('settings-confirm-pw').clear().type('NewPass@123');
    cy.cyGet('settings-password-save').click();
    cy.wait('@changePassword');
    cy.contains('Password changed successfully').should('be.visible');
  });

  it('toggles a notification channel and persists it', () => {
    cy.cyGet('settings-tab-notifications').click();
    cy.contains('h2', 'Alert delivery').should('be.visible');
    cy.cyGet('settings-phone').should('be.visible');
    cy.cyGet('settings-channel-notifyEmail').should('be.checked').click();
    cy.wait('@patchPrefs').its('request.body').should((b: { notifyEmail: boolean }) => {
      expect(b.notifyEmail).to.eq(false);
    });
    cy.contains('Notification preferences saved').should('be.visible');
  });

  it('shows account details on the Account tab', () => {
    cy.cyGet('settings-tab-danger').click();
    cy.contains('h2', 'Account Information').should('be.visible');
    cy.contains('Account Type').should('be.visible');
    cy.contains('customer').should('be.visible');
    cy.cyGet('settings-signout').should('be.visible');
  });
});
