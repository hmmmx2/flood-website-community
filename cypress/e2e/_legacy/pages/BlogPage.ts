/**
 * Page Object Model — /blog and /blog/[id]
 */
export class BlogPage {
  // ── Selectors ────────────────────────────────────────────────────────────

  readonly listUrl = '/blog';

  get blogCards() {
    return cy.get('[data-testid="blog-card"], article').filter(':visible');
  }

  get featuredSection() {
    return cy.contains(/featured/i).closest('section, div');
  }

  get paginationNextButton() {
    return cy.contains(/next|load more/i).filter('button, a');
  }

  get searchInput() {
    return cy.get('input[type="search"], input[placeholder*="search" i]').first();
  }

  get emptyState() {
    return cy.contains(/no blog|no article|empty/i);
  }

  // Detail page
  get blogTitle() {
    return cy.get('h1, [data-testid="blog-title"]').first();
  }

  get blogBody() {
    return cy.get('[data-testid="blog-body"], article, .prose').first();
  }

  get backLink() {
    return cy.contains(/back|← blog/i);
  }

  // Admin controls
  get createBlogButton() {
    return cy.contains(/create|new blog|add blog/i).filter('button, a');
  }

  get editBlogButton() {
    return cy.contains(/edit/i).filter('button, a');
  }

  get deleteBlogButton() {
    return cy.contains(/delete/i).filter('button');
  }

  get confirmDeleteButton() {
    return cy.contains(/confirm|yes|delete/i).filter('button');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the blog list page. */
  visit(): this {
    cy.visit(this.listUrl);
    return this;
  }

  /** Navigate to a specific blog detail page. */
  visitDetail(id: string): this {
    cy.visit(`/blog/${id}`);
    return this;
  }

  /** Wait for blog list to load. */
  waitForBlogs(): this {
    cy.wait('@getBlogs');
    cy.waitForPageLoad();
    return this;
  }

  /** Click the first blog card to navigate to its detail. */
  openFirstBlog(): this {
    this.blogCards.first().click();
    return this;
  }

  /** Assert the blog list is visible. */
  assertListVisible(): this {
    cy.url().should('include', '/blog');
    cy.url().should('not.include', '/login');
    return this;
  }

  /** Assert a blog title is visible. */
  assertBlogVisible(title: string): this {
    cy.contains(title).should('be.visible');
    return this;
  }
}
