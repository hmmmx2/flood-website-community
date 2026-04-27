/**
 * Community Website — Feed E2E Tests
 * Covers: post list, create post, like, comment
 */
describe('Community Feed', () => {
  beforeEach(() => {
    cy.loginAsUser();
  });

  describe('Post feed', () => {
    it('loads the home/feed page', () => {
      cy.visit('/');
      cy.waitForPageLoad();
      cy.wait('@getPosts');
      cy.get('body').should('be.visible');
    });

    it('displays posts from API', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.waitForPageLoad();

      cy.contains('Flood situation near Sungai Sarawak').should('be.visible');
      cy.contains('Emergency supplies available at community centre').should('be.visible');
    });

    it('shows author names on posts', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.waitForPageLoad();

      cy.contains('John Doe').should('be.visible');
      cy.contains('Jane Smith').should('be.visible');
    });

    it('shows like counts on posts', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.waitForPageLoad();

      cy.contains('12').should('exist');
      cy.contains('45').should('exist');
    });

    it('shows empty state when no posts exist', () => {
      cy.intercept('GET', '/api/posts*', { body: { content: [], totalElements: 0 } }).as('emptyPosts');
      cy.visit('/');
      cy.wait('@emptyPosts');
      cy.contains(/no posts|be the first|empty/i).should('be.visible');
    });
  });

  describe('Create post', () => {
    it('renders a create post button or trigger', () => {
      cy.visit('/');
      cy.waitForPageLoad();
      cy.get('button, textarea').contains(/create|post|share|write/i).should('exist');
    });

    it('opens post creation modal/form', () => {
      cy.visit('/');
      cy.waitForPageLoad();
      cy.get('button, textarea').contains(/create|post|share|write/i).first().click();
      cy.get('textarea, input[name="content"]').should('be.visible');
    });

    it('creates a post successfully', () => {
      cy.visit('/');
      cy.waitForPageLoad();

      cy.get('button, textarea').contains(/create|post|share|write/i).first().click();

      cy.get('input[name="title"], input[placeholder*="title" i]').first()
        .type('New community update');
      cy.get('textarea[name="content"], textarea[placeholder*="content" i]').first()
        .type('This is a test post about the current flood situation.');

      cy.get('button[type="submit"]').filter(':visible').first().click();
      cy.wait('@createPost');

      cy.contains(/posted|success|created/i).should('be.visible');
    });
  });

  describe('Like functionality', () => {
    it('has like buttons on posts', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.waitForPageLoad();

      cy.get('button[aria-label*="like" i], button').contains(/like|♥|❤/i).should('exist');
    });

    it('toggles like on click', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.waitForPageLoad();

      cy.get('button[aria-label*="like" i]').first().click();
      cy.wait('@toggleLike');
    });
  });

  describe('API error handling', () => {
    it('shows error when feed fails to load', () => {
      cy.intercept('GET', '/api/posts*', { statusCode: 500 }).as('postsFail');
      cy.visit('/');
      cy.wait('@postsFail');
      cy.contains(/error|failed|try again/i).should('be.visible');
    });
  });
});
