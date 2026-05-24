/// <reference types="cypress" />

describe('Community · create post', () => {
  beforeEach(() => {
    cy.loginViaMock();
    cy.interceptFeed();
    cy.visit('/');
    cy.wait('@getPosts');
  });

  it('opens the compose modal from the feed compose bar', () => {
    cy.cyGet('feed-compose-open').click();
    cy.cyGet('create-post-modal').should('be.visible');
    cy.contains('h2', 'Create Post').should('be.visible');
  });

  it('keeps the Post button disabled until title and content are present', () => {
    cy.cyGet('feed-compose-open').click();
    cy.cyGet('create-post-submit').should('be.disabled');
    cy.cyGet('create-post-title').type('Flash flood near Penampang');
    cy.cyGet('create-post-submit').should('be.disabled');
    cy.cyGet('create-post-content').type('Water rising fast — avoid the riverside road.');
    cy.cyGet('create-post-submit').should('not.be.disabled');
  });

  it('exposes the group selector and image drop-zone affordances', () => {
    cy.cyGet('feed-compose-open').click();
    cy.cyGet('create-post-group').should('be.visible').find('option').should('have.length.greaterThan', 1);
    cy.cyGet('create-post-dropzone')
      .should('have.attr', 'role', 'button')
      .and('have.attr', 'aria-label');
  });

  it('submits a new post and prepends it to the feed', () => {
    cy.cyGet('feed-compose-open').click();
    cy.cyGet('create-post-title').type('Flash flood near Penampang');
    cy.cyGet('create-post-content').type('Water rising fast — avoid the riverside road.');
    cy.cyGet('create-post-submit').click();
    cy.wait('@createPost').its('request.body').should((body: { title: string; content: string }) => {
      expect(body.title).to.eq('Flash flood near Penampang');
      expect(body.content).to.contain('Water rising fast');
    });
    cy.cyGet('create-post-modal').should('not.exist');
    cy.cyGet('feed-list').should('contain', 'Flash flood near Penampang');
  });

  it('surfaces a validation error when content is whitespace only', () => {
    cy.cyGet('feed-compose-open').click();
    cy.cyGet('create-post-title').type('Title only');
    cy.cyGet('create-post-content').type('   ');
    // Button stays disabled (no trimmed content) — the modal never submits.
    cy.cyGet('create-post-submit').should('be.disabled');
  });

  it('closes the modal via Cancel without creating a post', () => {
    cy.cyGet('feed-compose-open').click();
    cy.cyGet('create-post-cancel').click();
    cy.cyGet('create-post-modal').should('not.exist');
  });
});
