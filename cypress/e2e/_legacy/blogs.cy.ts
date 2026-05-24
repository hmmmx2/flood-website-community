/**
 * Community Website — Blog E2E Tests
 * Covers: blog listing (public), blog detail, navigation
 */
describe('Blog', () => {
  describe('Blog listing (public)', () => {
    beforeEach(() => {
      cy.interceptBlogs();
    });

    it('loads the blog page without authentication', () => {
      cy.visit('/blog');
      cy.waitForPageLoad();
      cy.wait('@getBlogs');
      cy.get('body').should('be.visible');
      cy.url().should('not.include', '/login');
    });

    it('displays blog articles', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains('Understanding Flood Risk in Kuching').should('be.visible');
    });

    it('shows blog categories', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains(/education|safety/i).should('exist');
    });

    it('shows empty state when no blogs', () => {
      cy.intercept('GET', '/api/blogs*', { body: { content: [], totalElements: 0 } }).as('emptyBlogs');
      cy.visit('/blog');
      cy.wait('@emptyBlogs');
      cy.contains(/no blog|no article|empty/i).should('be.visible');
    });
  });

  describe('Blog detail', () => {
    it('navigates to blog detail on click', () => {
      cy.interceptBlogs();
      cy.intercept('GET', '/api/blogs/blog-uuid-001', {
        body: {
          id: 'blog-uuid-001',
          title: 'Understanding Flood Risk in Kuching',
          body: 'Kuching faces annual flooding due to its geography...',
          category: 'Education',
          isFeatured: true,
          createdAt: '2025-01-01T00:00:00Z',
        },
      }).as('getBlogDetail');

      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains('Understanding Flood Risk in Kuching').click();
      cy.url().should('include', '/blog/');
    });
  });

  describe('Blog with authentication', () => {
    beforeEach(() => {
      cy.loginAsUser();
      cy.interceptBlogs();
    });

    it('renders blog page when logged in', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains('Understanding Flood Risk in Kuching').should('be.visible');
    });
  });
});
