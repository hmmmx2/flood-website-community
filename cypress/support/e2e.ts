import './commands';

Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('hydrat') ||
    err.message.includes('ResizeObserver') ||
    err.message.includes('Non-Error promise rejection')
  ) {
    return false;
  }
  return true;
});

beforeEach(() => {
  cy.clearLocalStorage();
  cy.clearCookies();
});
