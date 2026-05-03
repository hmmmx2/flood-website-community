/**
 * E2E — Post page threaded comments (BFF + UI shell)
 *
 * Mocks BFF JSON so the page renders without a live Java API.
 */

const iso = "2026-01-15T10:00:00.000Z";

const mockPost = {
  id: "p1",
  authorId: "a1",
  authorName: "Test Author",
  title: "Flood update",
  content: "River levels stable.",
  likesCount: 3,
  commentsCount: 1,
  likedByMe: false,
  createdAt: iso,
  updatedAt: iso,
};

const mockCommentsPage = {
  comments: [
    {
      id: "c1",
      parentId: null,
      authorId: "a2",
      authorName: "Commenter",
      content: "Thanks for the update.",
      score: 3,
      myVote: 0,
      createdAt: iso,
      updatedAt: undefined,
      deleted: false,
      replyCount: 0,
    },
  ],
  totalTopLevel: 1,
  page: 0,
  size: 20,
};

describe("Post page — comments", () => {
  beforeEach(() => {
    cy.intercept("GET", "**/api/auth/session", { body: null, statusCode: 200 });
    cy.intercept("GET", "**/api/posts/p1", { body: mockPost }).as("getPost");
    cy.intercept("GET", "**/api/posts/p1/comments**", { body: mockCommentsPage }).as("getComments");
  });

  it("loads sort options and shows a top-level comment", () => {
    cy.visit("/post/p1");
    cy.waitForPageLoad();
    cy.wait("@getPost");
    cy.wait("@getComments");
    cy.contains("Flood update").should("be.visible");
    cy.contains("Top").should("be.visible");
    cy.contains("New").should("be.visible");
    cy.contains("Old").should("be.visible");
    cy.contains("Thanks for the update.").should("be.visible");
  });

  it("exposes an id anchor for deep links", () => {
    cy.visit("/post/p1#comment-c1");
    cy.waitForPageLoad();
    cy.get("#comment-c1").should("exist");
  });
});
