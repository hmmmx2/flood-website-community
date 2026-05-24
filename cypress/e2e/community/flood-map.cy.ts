/// <reference types="cypress" />

// The Google Map canvas itself isn't asserted (it needs a live Maps key +
// external tiles); these tests cover the data-driven chrome around it —
// zone stats, the level-status legend, filters and the error path.

describe('Community · flood map', () => {
  beforeEach(() => {
    cy.interceptZones();
  });

  it('renders the header and zone counts from the live data', () => {
    cy.visit('/flood-map');
    cy.wait('@getZones');
    cy.contains('h1', 'Flood Map').should('be.visible');
    cy.contains('Showing').should('contain', '5').and('contain', 'zones');
    cy.contains('Live').should('be.visible');
  });

  it('exposes the level-status legend (Normal / Alert / Warning / Critical)', () => {
    cy.visit('/flood-map');
    cy.wait('@getZones');
    cy.cyGet('map-legend-dry').should('contain', 'Normal');
    cy.cyGet('map-legend-normal').should('contain', 'Alert');
    cy.cyGet('map-legend-warning').should('contain', 'Warning');
    cy.cyGet('map-legend-critical').should('contain', 'Critical');
    // Each level has exactly one zone in the fixture.
    cy.cyGet('map-legend-critical').should('contain', '(1)');
  });

  it('filters the visible zones when a legend status is toggled', () => {
    cy.visit('/flood-map');
    cy.wait('@getZones');
    cy.cyGet('map-legend-critical').click().should('have.attr', 'aria-pressed', 'true');
    cy.contains('Showing').should('contain', '1').and('contain', 'of');
  });

  it('filters zones via the search field', () => {
    cy.visit('/flood-map');
    cy.wait('@getZones');
    cy.get('[role="searchbox"]').first().type('Penampang');
    cy.contains('Showing').should('contain', '1');
  });

  it('shows a connection-error state with retry when zones fail to load', () => {
    cy.intercept('GET', '/api/zones*', { statusCode: 500, body: { error: 'boom' } }).as('getZonesFail');
    cy.visit('/flood-map');
    cy.wait('@getZonesFail');
    cy.contains('Connection Error').should('be.visible');
    cy.contains('button', 'Retry Connection').should('be.visible');
  });
});
