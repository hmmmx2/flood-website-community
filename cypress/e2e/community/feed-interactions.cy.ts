/// <reference types="cypress" />

const POST_1 = '[data-cy="post-card"][data-cy-post-id="post-uuid-001"]';
const POST_2 = '[data-cy="post-card"][data-cy-post-id="post-uuid-002"]';

describe('Community · feed interactions', () => {
  beforeEach(() => {
    cy.loginViaMock();
    cy.interceptFeed();
    cy.visit('/');
    cy.wait('@getPosts');
  });

  it('likes a post optimistically and reconciles with the server count', () => {
    // post-uuid-001 starts not-liked at 12; the like endpoint returns 13.
    cy.get(POST_1).find('[data-cy="post-like"]').should('have.attr', 'aria-pressed', 'false');
    cy.get(POST_1).find('[data-cy="post-like"]').click();
    cy.wait('@likePost');
    cy.get(POST_1).find('[data-cy="post-like"]').should('have.attr', 'aria-pressed', 'true');
    cy.get(POST_1).find('[data-cy="post-like"]').should('contain', '13');
  });

  it('rolls the like back to the snapshot when the server rejects it', () => {
    cy.intercept('POST', '/api/posts/*/like', { statusCode: 500, body: { error: 'boom' } }).as('likeFail');
    cy.get(POST_1).find('[data-cy="post-like"]').click();
    cy.wait('@likeFail');
    // Optimistic toggle is reverted: back to not-liked / original 12.
    cy.get(POST_1).find('[data-cy="post-like"]').should('have.attr', 'aria-pressed', 'false');
    cy.get(POST_1).find('[data-cy="post-like"]').should('contain', '12');
  });

  it('links each post to its detail thread via the Comments control', () => {
    cy.get(POST_1)
      .find('[data-cy="post-comments"]')
      .should('have.attr', 'href', '/post/post-uuid-001#comments');
  });

  it('opens the Share modal with a copyable permalink', () => {
    cy.get(POST_2).find('[data-cy="post-share"]').click();
    cy.cyGet('share-modal').should('be.visible');
    cy.contains('h3', 'Share Post').should('be.visible');
    cy.cyGet('share-modal').find('input[readonly]').should('have.value', `${Cypress.config('baseUrl')}/post/post-uuid-002`);
  });
});
