/**
 * Page Object Model — /g/[slug]
 *
 * Community group detail page.
 */
export class GroupPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  get groupName() {
    return cy.get('h1, [data-testid="group-name"]').first();
  }

  get groupDescription() {
    return cy.get('[data-testid="group-description"], .group-desc, p').first();
  }

  get memberCount() {
    return cy.contains(/member/i);
  }

  get joinButton() {
    return cy.contains(/join/i).filter('button');
  }

  get leaveButton() {
    return cy.contains(/leave/i).filter('button');
  }

  get createPostButton() {
    return cy.contains(/create|post|write/i).filter('button, textarea');
  }

  get postCards() {
    return cy.get('[data-testid="post-card"], article').filter(':visible');
  }

  get notFoundMessage() {
    return cy.contains(/not found|404|doesn't exist/i);
  }

  get errorMessage() {
    return cy.contains(/error|failed|something went wrong/i);
  }

  get backLink() {
    return cy.contains(/back|community/i).filter('a, button');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to a community group detail page. */
  visit(slug: string): this {
    cy.visit(`/g/${slug}`);
    return this;
  }

  /** Click the Join button. */
  join(): this {
    this.joinButton.click();
    return this;
  }

  /** Click the Leave button. */
  leave(): this {
    this.leaveButton.click();
    return this;
  }

  /** Assert the group name is visible. */
  assertGroupNameVisible(name: string): this {
    cy.contains(name).should('be.visible');
    return this;
  }

  /** Assert that the join button is present. */
  assertCanJoin(): this {
    this.joinButton.should('be.visible');
    return this;
  }

  /** Assert that the leave button is present. */
  assertCanLeave(): this {
    this.leaveButton.should('be.visible');
    return this;
  }
}
