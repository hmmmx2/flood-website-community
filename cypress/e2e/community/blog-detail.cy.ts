/// <reference types="cypress" />

describe('Community · blog detail', () => {
  it('renders the article with category, title, body and back link', () => {
    cy.interceptBlogs();
    cy.visit('/blog/blog-uuid-001');
    cy.wait('@getBlog');
    cy.contains('h1', 'Understanding Flood Risk in Kuching').should('be.visible');
    cy.contains('Education').should('be.visible');
    cy.contains('Kuching faces annual flooding').should('be.visible');
    cy.contains('a', 'Back to Blog').should('have.attr', 'href', '/blog');
  });

  it('shows a not-found state when the article is missing', () => {
    cy.intercept('GET', '/api/blogs/*', { statusCode: 404, body: { error: 'not found' } }).as('getMissing');
    cy.visit('/blog/does-not-exist');
    cy.wait('@getMissing');
    cy.contains('Article Not Found').should('be.visible');
  });
});
