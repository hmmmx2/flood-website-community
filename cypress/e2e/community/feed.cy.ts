/// <reference types="cypress" />

import type { MockPagedPosts, MockPost } from '../../support/types';

function makePost(over: Partial<MockPost> & Pick<MockPost, 'id' | 'title'>): MockPost {
  return {
    authorId: 'author-x',
    authorName: 'Author X',
    authorAvatar: null,
    groupId: null,
    groupSlug: null,
    groupName: null,
    content: 'body',
    imageUrl: null,
    likesCount: 0,
    commentsCount: 0,
    likedByMe: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...over,
  };
}

describe('Community · feed (home)', () => {
  context('authenticated', () => {
    beforeEach(() => {
      cy.loginViaMock();
      cy.interceptFeed();
    });

    it('renders the authenticated compose bar and the mocked posts', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.cyGet('feed-compose-open').should('be.visible');
      cy.cyGet('feed-list').should('be.visible');
      cy.cyGet('post-card').should('have.length', 3);
      cy.contains('Flood situation near Sungai Sabah').should('be.visible');
    });

    it('shows the end-of-feed marker when there are no further pages', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.cyGet('feed-end').should('contain', "that's the end of the feed");
    });

    it('re-queries the backend with sort=top when the Top tab is selected', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.cyGet('feed-sort-top').click();
      cy.wait('@getPosts').its('request.url').should('include', 'sort=top');
    });

    it('re-queries the backend with the search term when filtering the feed', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.get('input[aria-label="Filter feed"]').type('Emergency');
      cy.wait('@getPosts').its('request.url').should('include', 'search=Emergency');
    });

    it('paginates with Load more and then shows the end marker', () => {
      cy.intercept('GET', '/api/posts*', (req) => {
        const url = new URL(req.url);
        if (url.searchParams.get('page') === '0') {
          const body: MockPagedPosts = {
            content: [makePost({ id: 'p-1', title: 'First page post' })],
            totalElements: 2,
            totalPages: 2,
            number: 0,
            size: 10,
            last: false,
          };
          req.reply({ body });
        } else {
          const body: MockPagedPosts = {
            content: [makePost({ id: 'p-2', title: 'Second page post' })],
            totalElements: 2,
            totalPages: 2,
            number: 1,
            size: 10,
            last: true,
          };
          req.reply({ body });
        }
      }).as('getPaged');

      cy.visit('/');
      cy.wait('@getPaged');
      cy.contains('First page post').should('be.visible');
      cy.cyGet('feed-load-more').click();
      cy.wait('@getPaged').its('request.url').should('include', 'page=1');
      cy.contains('Second page post').should('be.visible');
      cy.cyGet('feed-end').should('be.visible');
    });

    it('opens the global search modal (Ctrl+K), finds a post and navigates to it', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.get('body').type('{ctrl}k');
      cy.cyGet('search-modal').should('be.visible');
      cy.cyGet('search-modal').find('[role="searchbox"]').type('Emergency');
      cy.cyGet('search-result-post').should('contain', 'Emergency supplies').click();
      cy.location('pathname').should('eq', '/post/post-uuid-002');
    });

    it('shows a "No results" empty state in the search modal for an unmatched query', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.get('body').type('{ctrl}k');
      cy.cyGet('search-modal').find('[role="searchbox"]').type('zzzznopost');
      cy.cyGet('search-no-results').should('be.visible');
    });

    it('finds a community group in the search modal', () => {
      cy.visit('/');
      cy.wait('@getPosts');
      cy.get('body').type('{ctrl}k');
      cy.cyGet('search-modal').find('[role="searchbox"]').type('Kuching');
      cy.cyGet('search-result-group').should('contain', 'flood-alerts-kuching');
    });
  });

  context('anonymous', () => {
    it('serves the feed read-only with a join CTA and no compose bar', () => {
      cy.interceptFeed();
      cy.visit('/');
      cy.wait('@getPosts');
      cy.cyGet('feed-compose-open').should('not.exist');
      cy.contains('a', 'Log In').should('be.visible');
      cy.contains('Join the community').should('be.visible');
    });
  });
});
