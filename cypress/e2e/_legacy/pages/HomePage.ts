/**
 * Page Object Model — / (Home / Community Feed)
 *
 * The home feed renders posts, a create-post trigger, and search.
 */
export class HomePage {
  // ── Selectors ────────────────────────────────────────────────────────────

  readonly url = '/';

  get postCards() {
    return cy.get('[data-testid="post-card"], article').filter(':visible');
  }

  get createPostTrigger() {
    // The feed shows either a button or a textarea as the post creation trigger.
    return cy.get('button, textarea, [data-testid="create-post-trigger"]')
      .contains(/create|post|share|write|what.*mind/i)
      .first();
  }

  get postTitleInput() {
    return cy.get('input[name="title"], input[placeholder*="title" i]').first();
  }

  get postContentInput() {
    return cy.get('textarea[name="content"], textarea[placeholder*="content" i], textarea[placeholder*="what" i]').first();
  }

  get postSubmitButton() {
    return cy.get('button[type="submit"]').filter(':visible').first();
  }

  get likeButtons() {
    return cy.get('button[aria-label*="like" i], [data-testid="like-button"]');
  }

  get loadMoreButton() {
    return cy.contains(/load more|show more/i);
  }

  get searchTrigger() {
    return cy.get('button[aria-label="Search"], [data-testid="search-trigger"]').first();
  }

  get shareButtons() {
    return cy.get('button[aria-label*="share" i], [data-testid="share-button"]');
  }

  get emptyState() {
    return cy.contains(/no posts|be the first|empty/i);
  }

  get errorState() {
    return cy.contains(/error|failed|try again/i);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the home page. */
  visit(): this {
    cy.visit(this.url);
    return this;
  }

  /** Wait for the post feed to finish loading. */
  waitForFeed(): this {
    cy.wait('@getPosts');
    cy.waitForPageLoad();
    return this;
  }

  /** Open the create-post modal/form. */
  openCreatePost(): this {
    this.createPostTrigger.click();
    return this;
  }

  /** Fill and submit the create-post form. */
  createPost(title: string, content: string): this {
    this.postTitleInput.clear().type(title);
    this.postContentInput.clear().type(content);
    this.postSubmitButton.click();
    return this;
  }

  /** Click the like button on the nth post card (0-indexed). */
  likePost(index = 0): this {
    this.likeButtons.eq(index).click();
    return this;
  }

  /** Assert that a post with the given title is visible. */
  assertPostVisible(title: string): this {
    cy.contains(title).should('be.visible');
    return this;
  }

  /** Assert the create-post success feedback. */
  assertPostCreated(): this {
    cy.contains(/posted|success|created/i).should('be.visible');
    return this;
  }
}
