/// <reference types="cypress" />

describe('Community · blog list', () => {
  beforeEach(() => {
    cy.interceptBlogs();
    cy.visit('/blog');
    cy.wait('@getBlogs');
  });

  it('renders the blog header, category tabs and article cards', () => {
    cy.contains('h1', 'Blog & News').should('be.visible');
    cy.contains('button', 'All').should('be.visible');
    cy.contains('button', 'Safety Tips').should('be.visible');
    cy.contains('Understanding Flood Risk in Kuching').should('be.visible');
    cy.contains('Flood Safety Tips for Families').should('be.visible');
  });

  it('shows the featured hero article', () => {
    cy.contains('Featured').should('be.visible');
  });

  it('filters by category via the backend query', () => {
    cy.contains('button', 'Safety Tips').click();
    cy.wait('@getBlogs').its('request.url').should('include', 'category=Safety');
  });

  it('client-filters articles by the search field and shows an empty state', () => {
    cy.get('input[aria-label="Search articles"]').type('Understanding');
    cy.contains('Understanding Flood Risk in Kuching').should('be.visible');
    cy.get('input[aria-label="Search articles"]').clear().type('zzznomatch');
    cy.contains('No articles match').should('be.visible');
  });

  it('navigates to an article from a card', () => {
    cy.contains('Flood Safety Tips for Families').click();
    cy.location('pathname').should('eq', '/blog/blog-uuid-002');
  });
});
