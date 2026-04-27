/**
 * Community Website — Sensors Page E2E Tests
 * Covers: sensor list, favourites, stats, filter, map embed
 */
describe('Sensors Page', () => {
  beforeEach(() => {
    cy.loginAsUser();
    cy.interceptSensors();
    cy.interceptFavourites();
  });

  describe('Sensor listing', () => {
    it('loads the sensors page', () => {
      cy.visit('/sensors');
      cy.waitForPageLoad();
      cy.wait('@getSensors');
      cy.get('body').should('be.visible');
    });

    it('displays nodes from API', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.waitForPageLoad();

      cy.contains('Node 102782478').should('be.visible');
      cy.contains('Node 102782479').should('be.visible');
    });

    it('shows status badges (active, warning, inactive)', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.waitForPageLoad();

      cy.contains(/active/i).should('exist');
      cy.contains(/warning/i).should('exist');
    });

    it('displays stat pills at the top', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.waitForPageLoad();

      cy.contains(/total|online|warning|critical|saved/i).should('exist');
    });

    it('shows water level information per node', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.waitForPageLoad();

      cy.contains(/level|m\b/i).should('exist');
    });
  });

  describe('Favourites', () => {
    it('displays saved favourites section', () => {
      cy.visit('/sensors');
      cy.wait('@getFavourites');
      cy.waitForPageLoad();

      cy.contains(/saved|favourite|★/i).should('exist');
    });

    it('adds a node to favourites', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.wait('@getFavourites');
      cy.waitForPageLoad();

      cy.get('button[aria-label*="favourite" i], button').contains(/♥|save|★/i).first().click();
      cy.wait('@addFavourite');
    });

    it('removes a node from favourites', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.wait('@getFavourites');
      cy.waitForPageLoad();

      // The first node (102782478) is already favourited
      cy.get('button[aria-label*="unfavourite" i], button[aria-label*="remove" i]')
        .first().click();
      cy.wait('@removeFavourite');
    });

    it('shows ★ Saved count pill', () => {
      cy.visit('/sensors');
      cy.wait('@getFavourites');
      cy.waitForPageLoad();

      // 1 favourite in mock data
      cy.contains(/saved|1.*saved|★/i).should('exist');
    });
  });

  describe('Filter chips', () => {
    it('renders filter chips for All, Favourites, status levels', () => {
      cy.visit('/sensors');
      cy.waitForPageLoad();

      cy.get('button, [role="tab"]').contains(/all/i).should('exist');
      cy.get('button, [role="tab"]').contains(/favourite|★/i).should('exist');
    });

    it('filters to show only favourite nodes', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.wait('@getFavourites');
      cy.waitForPageLoad();

      cy.get('button, [role="tab"]').contains(/favourite|★/i).click();
      cy.contains('Node 102782478').should('be.visible');
    });

    it('filters to show only warning nodes', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.waitForPageLoad();

      cy.get('button, [role="tab"]').contains(/warning/i).click();
      cy.contains('Node 102782479').should('be.visible');
    });
  });

  describe('View on Map', () => {
    it('has "View on Map" buttons', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.waitForPageLoad();

      cy.contains(/view.*map|map/i).should('exist');
    });

    it('opens map modal or navigates to map on click', () => {
      cy.visit('/sensors');
      cy.wait('@getSensors');
      cy.waitForPageLoad();

      cy.contains(/view.*map|map/i).first().click();
      // Either URL changes or a modal appears
      cy.get('iframe[src*="maps"], dialog, [role="dialog"], [class*="modal"]').then(($el) => {
        if ($el.length) {
          expect($el).to.be.visible;
        } else {
          cy.url().should('include', 'map');
        }
      });
    });
  });
});
