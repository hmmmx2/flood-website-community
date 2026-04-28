import './commands';

// ── Global exception handler ──────────────────────────────────────────────────
// Suppress well-known Next.js / React noise that is not test-relevant.
Cypress.on('uncaught:exception', (err) => {
  const ignored = [
    'hydrat',
    'ResizeObserver',
    'Non-Error promise rejection',
    'ChunkLoadError',
    'Loading chunk',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
  ];
  if (ignored.some((s) => err.message.includes(s))) return false;
  return true;
});

// ── Global beforeEach ─────────────────────────────────────────────────────────
beforeEach(() => {
  cy.clearLocalStorage();
  cy.clearCookies();

  // Stub health check so it does not create noise in tests.
  cy.intercept('GET', '/api/health', { body: { status: 'ok' } }).as('health');
});
