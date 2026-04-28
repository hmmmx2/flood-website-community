/**
 * Page Object Model — /sensors
 *
 * The sensors page shows a list of IoT water-level nodes with filter chips,
 * a favourites section, and map-view buttons.
 */
export class SensorsPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  readonly url = '/sensors';

  get nodeCards() {
    return cy.get('[data-testid="node-card"], .node-card').filter(':visible');
  }

  get statPills() {
    return cy.get('[data-testid="stat-pill"], .stat-pill').filter(':visible');
  }

  get filterChipAll() {
    return cy.get('button, [role="tab"]').contains(/^all$/i).first();
  }

  get filterChipFavourites() {
    return cy.get('button, [role="tab"]').contains(/favourite|★/i).first();
  }

  get filterChipWarning() {
    return cy.get('button, [role="tab"]').contains(/warning/i).first();
  }

  get filterChipCritical() {
    return cy.get('button, [role="tab"]').contains(/critical/i).first();
  }

  get favouriteButtons() {
    return cy.get('button[aria-label*="favourite" i], [data-testid="favourite-btn"]');
  }

  get unfavouriteButtons() {
    return cy.get('button[aria-label*="unfavourite" i], button[aria-label*="remove" i], [data-testid="unfavourite-btn"]');
  }

  get viewOnMapButtons() {
    return cy.contains(/view.*map|map/i).filter('button, a');
  }

  get savedCountPill() {
    return cy.contains(/saved|★.*saved/i);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the sensors page. */
  visit(): this {
    cy.visit(this.url);
    return this;
  }

  /** Wait for sensors and favourites to finish loading. */
  waitForData(): this {
    cy.wait('@getSensors');
    cy.wait('@getFavourites');
    cy.waitForPageLoad();
    return this;
  }

  /** Click the "All" filter chip. */
  filterAll(): this {
    this.filterChipAll.click();
    return this;
  }

  /** Click the "Favourites" filter chip. */
  filterFavourites(): this {
    this.filterChipFavourites.click();
    return this;
  }

  /** Click the "Warning" filter chip. */
  filterWarning(): this {
    this.filterChipWarning.click();
    return this;
  }

  /** Add the nth node to favourites (0-indexed). */
  addFavourite(index = 0): this {
    this.favouriteButtons.eq(index).click();
    return this;
  }

  /** Remove the nth node from favourites (0-indexed). */
  removeFavourite(index = 0): this {
    this.unfavouriteButtons.eq(index).click();
    return this;
  }

  /** Assert that a node name is visible. */
  assertNodeVisible(name: string): this {
    cy.contains(name).should('be.visible');
    return this;
  }

  /** Assert that a status badge text is present. */
  assertStatusBadgeVisible(status: string): this {
    cy.contains(new RegExp(status, 'i')).should('exist');
    return this;
  }
}
