/// <reference types="cypress" />

describe('Community · notifications bell', () => {
  beforeEach(() => {
    cy.loginViaMock();
    cy.interceptFeed();
    cy.interceptNotifications();
    cy.intercept('GET', '/api/notifications/unread-count', { body: { count: 2 } }).as('unread');
    cy.intercept('POST', '/api/notifications/read-all', { statusCode: 200, body: {} }).as('readAll');
    cy.visit('/');
    cy.wait('@getPosts');
    cy.wait('@getNotifications');
  });

  it('opens the bell dropdown and lists notifications', () => {
    cy.cyGet('nav-notifications').click();
    cy.cyGet('notif-dropdown').should('be.visible');
    cy.contains('Flood Alert — Sungai Sabah').should('be.visible');
    cy.contains('a', 'Notification settings')
      .should('have.attr', 'href')
      .and('include', '/settings');
  });

  it('marks all notifications read', () => {
    cy.cyGet('nav-notifications').click();
    cy.cyGet('notif-mark-all').should('be.visible').click();
    cy.wait('@readAll');
    cy.cyGet('notif-mark-all').should('not.exist');
  });
});
