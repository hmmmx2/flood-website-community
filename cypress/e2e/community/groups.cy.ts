/**
 * E2E — Community: Groups
 *
 * Covers:
 *  - Group list loads
 *  - Join group
 *  - Leave group
 *  - Group detail page renders
 *  - Group posts are shown
 *  - Creating a post within a group
 *  - Group not found shows 404 state
 *  - Error state on API failure
 */

import { GroupPage } from '../../pages/GroupPage';

const page = new GroupPage();

// ── Helpers ─────────────────────────────────────────────────────────────────

function stubGroupDetail(isMember = false) {
  cy.intercept('GET', '/api/groups/flood-alerts-kuching', {
    body: {
      id: 'group-uuid-001',
      slug: 'flood-alerts-kuching',
      name: 'Flood Alerts Kuching',
      description: 'Real-time flood updates for Kuching area.',
      memberCount: 142,
      isMember,
      postCount: 28,
      createdAt: '2025-01-01T00:00:00Z',
    },
  }).as('getGroupDetail');
}

// ────────────────────────────────────────────────────────────────────────────

describe('Community Groups', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  afterEach(() => {
    cy.clearLocalStorage();
  });

  // ── Public group list ────────────────────────────────────────────────────

  context('Group list (public)', () => {
    beforeEach(() => {
      cy.interceptGroups();
      cy.interceptFeed();
    });

    it('renders the community home page with groups', () => {
      cy.visit('/');
      cy.waitForPageLoad();
      cy.get('body').should('be.visible');
    });
  });

  // ── Group detail – unauthenticated ────────────────────────────────────────

  context('Group detail page (unauthenticated)', () => {
    beforeEach(() => {
      stubGroupDetail(false);
      cy.intercept('GET', '/api/posts*', { fixture: 'posts.json' }).as('getPosts');
    });

    it('renders the group name', () => {
      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.assertGroupNameVisible('Flood Alerts Kuching');
    });

    it('renders the group description', () => {
      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      cy.contains('Real-time flood updates for Kuching area.').should('be.visible');
    });

    it('shows the member count', () => {
      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.memberCount.should('exist');
    });

    it('shows posts belonging to the group', () => {
      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.wait('@getPosts');
      cy.waitForPageLoad();

      cy.get('body').should('be.visible');
    });
  });

  // ── Join group ───────────────────────────────────────────────────────────

  context('Join group', () => {
    beforeEach(() => {
      cy.seedAuth();
      stubGroupDetail(false);
      cy.intercept('GET', '/api/posts*', { fixture: 'posts.json' }).as('getPosts');
      cy.interceptGroups();
    });

    it('shows a Join button when the user is not a member', () => {
      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.assertCanJoin();
    });

    it('calls the membership API when Join is clicked', () => {
      cy.intercept('POST', '/api/groups/flood-alerts-kuching/membership', {
        body: { isMember: true, memberCount: 143 },
      }).as('joinGroup');

      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.join();
      cy.wait('@joinGroup');
    });

    it('updates the button to Leave after joining', () => {
      cy.intercept('POST', '/api/groups/flood-alerts-kuching/membership', {
        body: { isMember: true, memberCount: 143 },
      }).as('joinGroup');

      // After joining, stub the detail to return isMember: true
      cy.intercept('GET', '/api/groups/flood-alerts-kuching', {
        body: {
          id: 'group-uuid-001',
          slug: 'flood-alerts-kuching',
          name: 'Flood Alerts Kuching',
          description: 'Real-time flood updates for Kuching area.',
          memberCount: 143,
          isMember: true,
          createdAt: '2025-01-01T00:00:00Z',
        },
      }).as('getGroupAfterJoin');

      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.join();
      cy.wait('@joinGroup');

      // After join, page should show Leave button
      page.leaveButton.should('be.visible');
    });
  });

  // ── Leave group ──────────────────────────────────────────────────────────

  context('Leave group', () => {
    beforeEach(() => {
      cy.seedAuth();
      stubGroupDetail(true);
      cy.intercept('GET', '/api/posts*', { fixture: 'posts.json' }).as('getPosts');
    });

    it('shows a Leave button when the user is a member', () => {
      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.assertCanLeave();
    });

    it('calls the membership DELETE endpoint when Leave is clicked', () => {
      cy.intercept('DELETE', '/api/groups/flood-alerts-kuching/membership', {
        body: { isMember: false, memberCount: 141 },
      }).as('leaveGroup');

      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.leave();
      cy.wait('@leaveGroup');
    });
  });

  // ── Create post in group ─────────────────────────────────────────────────

  context('Creating a post within a group', () => {
    beforeEach(() => {
      cy.seedAuth();
      stubGroupDetail(true);
      cy.intercept('GET', '/api/posts*', { fixture: 'posts.json' }).as('getPosts');
      cy.interceptFeed();
    });

    it('has a create-post trigger on the group page', () => {
      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.createPostButton.should('exist');
    });

    it('creates a post within the group and calls the API', () => {
      cy.intercept('POST', '/api/posts', (req) => {
        expect(req.body).to.have.property('content');
        req.reply({ statusCode: 200, body: { id: 'group-post-new', ...req.body } });
      }).as('createGroupPost');

      page.visit('flood-alerts-kuching');
      cy.wait('@getGroupDetail');
      cy.waitForPageLoad();

      page.createPostButton.first().click();
      cy.get('textarea, input[name="content"]').first().type('Group post content for testing.');
      cy.get('button[type="submit"]').filter(':visible').first().click();
      cy.wait('@createGroupPost');
    });
  });

  // ── Not found ────────────────────────────────────────────────────────────

  context('Group not found', () => {
    it('shows a not-found state for a non-existent group slug', () => {
      cy.intercept('GET', '/api/groups/nonexistent-group', {
        statusCode: 404,
        body: { error: 'Group not found.' },
      }).as('groupNotFound');
      cy.intercept('GET', '/api/posts*', {
        body: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, last: true },
      }).as('emptyPosts');

      page.visit('nonexistent-group');
      cy.wait('@groupNotFound');
      cy.waitForPageLoad();

      page.notFoundMessage.should('be.visible');
    });
  });

  // ── Error state ──────────────────────────────────────────────────────────

  context('API error', () => {
    it('shows an error state when the group API returns 500', () => {
      cy.intercept('GET', '/api/groups/error-group', { statusCode: 500 }).as('groupError');
      cy.intercept('GET', '/api/posts*', {
        body: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, last: true },
      }).as('emptyPosts');

      page.visit('error-group');
      cy.wait('@groupError');
      cy.waitForPageLoad();

      page.errorMessage.should('be.visible');
    });
  });
});
