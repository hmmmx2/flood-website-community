/// <reference types="cypress" />

describe('Community · register', () => {
  beforeEach(() => {
    cy.interceptAuth();
    cy.visit('/register');
    cy.wait('@anonSession');
  });

  it('renders all account fields and the sign-in link', () => {
    cy.get('#firstName').should('be.visible');
    cy.get('#lastName').should('be.visible');
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.get('#confirmPassword').should('be.visible');
    cy.contains('a', 'Sign In').should('have.attr', 'href', '/login');
  });

  it('flags mismatched passwords and disables submit', () => {
    cy.get('#password').type('Password@123');
    cy.get('#confirmPassword').type('Different@123');
    cy.contains('Passwords do not match').should('be.visible');
    cy.cyGet('register-submit').should('be.disabled');
  });

  it('toggles password visibility', () => {
    cy.get('#password').type('Password@123');
    cy.get('#password').should('have.attr', 'type', 'password');
    cy.cyGet('register-pw-toggle').click();
    cy.get('#password').should('have.attr', 'type', 'text');
  });

  it('rejects a password shorter than 8 characters', () => {
    cy.get('#firstName').type('Ada');
    cy.get('#lastName').type('Lovelace');
    cy.get('#email').type('ada@example.com');
    cy.get('#password').type('short');
    cy.get('#confirmPassword').type('short');
    cy.cyGet('register-submit').click();
    cy.cyGet('register-error').should('contain', 'at least 8 characters');
  });

  it('registers and hands off to verify-email', () => {
    cy.get('#firstName').type('Ada');
    cy.get('#lastName').type('Lovelace');
    cy.get('#email').type('ada@example.com');
    cy.get('#password').type('Password@123');
    cy.get('#confirmPassword').type('Password@123');
    cy.cyGet('register-submit').click();
    cy.wait('@registerPost');
    cy.location('pathname').should('eq', '/verify-email');
    cy.location('search').should('include', 'email=');
  });

  it('never leaks the dev verification code into the URL (QA P1-2)', () => {
    cy.intercept('POST', '/api/auth/register', {
      body: { email: 'ada@example.com', devCode: '654321' },
    }).as('registerDev');
    cy.get('#firstName').type('Ada');
    cy.get('#lastName').type('Lovelace');
    cy.get('#email').type('ada@example.com');
    cy.get('#password').type('Password@123');
    cy.get('#confirmPassword').type('Password@123');
    cy.cyGet('register-submit').click();
    cy.wait('@registerDev');
    cy.location('pathname').should('eq', '/verify-email');
    // The code is handed off via sessionStorage, never the URL.
    cy.location('search').should('not.include', 'devCode');
    // verify-email consumes the stashed code on mount and pre-fills the OTP
    // boxes — proof the handoff happened off-URL.
    cy.get('input[aria-label="Digit 1"]').should('have.value', '6');
    cy.get('input[aria-label="Digit 6"]').should('have.value', '1');
  });
});
