/// <reference types="cypress" />

describe('Community · post detail', () => {
  beforeEach(() => {
    cy.loginViaMock();
    cy.interceptFeed();
    // Single-post detail fetch (registered after interceptFeed so it wins).
    cy.intercept('GET', '/api/posts/post-uuid-001', { fixture: 'post-single.json' }).as('getPostDetail');
  });

  it('renders the full post with its comment section', () => {
    cy.visit('/post/post-uuid-001');
    cy.wait('@getPostDetail');
    cy.cyGet('post-card').should('be.visible');
    cy.contains('Flood situation near Sungai Sabah').should('be.visible');
    cy.contains('Water levels are rising rapidly').should('be.visible');
    cy.contains('h2', 'Comments').should('be.visible');
    cy.contains('No comments yet').should('be.visible');
  });

  it('likes the post from the detail view', () => {
    cy.visit('/post/post-uuid-001');
    cy.wait('@getPostDetail');
    cy.cyGet('post-like').should('contain', '12').click();
    cy.wait('@likePost');
    cy.cyGet('post-like').should('contain', '13').and('have.attr', 'aria-pressed', 'true');
  });

  it('shows a not-found state for a missing post', () => {
    cy.intercept('GET', '/api/posts/*', { statusCode: 404, body: { error: 'not found' } }).as('getMissing');
    cy.visit('/post/does-not-exist');
    cy.wait('@getMissing');
    cy.contains('Post not found').should('be.visible');
  });
});
