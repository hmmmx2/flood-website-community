import './commands';

// ── Global uncaught-exception filter ──────────────────────────────────────────
// Suppress well-known Next.js / React / network noise that isn't test-relevant.
// App bugs still surface — only the listed substrings are ignored.
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
    'EventSource',
  ];
  if (ignored.some((s) => err.message.includes(s))) return false;
  return true;
});

// ── Global setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();
  // Quiet the ambient providers (health check + IoT SSE) and default the
  // session to unauthenticated. `cy.loginViaMock()` overrides the session.
  cy.stubAmbient();
});
