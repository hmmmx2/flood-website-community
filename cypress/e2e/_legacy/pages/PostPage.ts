/**
 * Page Object Model — /post/[id]
 *
 * Community post detail page.
 */
export class PostPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  get postTitle() {
    return cy.get('h1, [data-testid="post-title"]').first();
  }

  get postContent() {
    return cy.get('[data-testid="post-content"], .post-body, article').first();
  }

  get authorName() {
    return cy.get('[data-testid="post-author"], .author-name').first();
  }

  get likeButton() {
    return cy.get('button[aria-label*="like" i], [data-testid="like-button"]').first();
  }

  get likeCount() {
    return cy.get('[data-testid="like-count"]').first();
  }

  get commentInput() {
    return cy.get('textarea[placeholder*="comment" i], input[placeholder*="comment" i], [data-testid="comment-input"]').first();
  }

  get commentSubmitButton() {
    return cy.get('button[type="submit"]').filter(':visible').first();
  }

  get commentsList() {
    return cy.get('[data-testid="comment"], .comment-item');
  }

  get backLink() {
    return cy.contains(/back|community|← /i).filter('a, button');
  }

  get shareButton() {
    return cy.get('button[aria-label*="share" i], [data-testid="share-button"]').first();
  }

  get editButton() {
    return cy.get('button[aria-label*="edit" i], [data-testid="edit-post"]').first();
  }

  get deleteButton() {
    return cy.get('button[aria-label*="delete" i], [data-testid="delete-post"]').first();
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to a specific post detail. */
  visit(id: string): this {
    cy.visit(`/post/${id}`);
    return this;
  }

  /** Click the like button. */
  likePost(): this {
    this.likeButton.click();
    return this;
  }

  /** Submit a comment. */
  addComment(text: string): this {
    this.commentInput.clear().type(text);
    this.commentSubmitButton.click();
    return this;
  }

  /** Assert post title is visible. */
  assertTitleVisible(title: string): this {
    cy.contains(title).should('be.visible');
    return this;
  }
}
