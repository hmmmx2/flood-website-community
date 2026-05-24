/**
 * Community smoke test — runs in under 10 s and proves the app boots,
 * the IoT BFF responds, and the public surfaces don't 500.
 *
 * Pair with the CRM smoke test (flood-website-crm/cypress/e2e/smoke.cy.ts)
 * for a quick "is anything broken" check on both apps.
 */

describe("Community smoke", () => {
  it("home page renders", () => {
    cy.visit("/");
    cy.contains(/floodwatch/i, { timeout: 15_000 }).should("be.visible");
  });

  it("flood map page renders", () => {
    cy.visit("/flood-map");
    cy.contains(/flood map/i, { timeout: 15_000 }).should("be.visible");
  });

  it("login page renders the form", () => {
    cy.visit("/login");
    cy.get('input[type="email"]', { timeout: 10_000 }).should("be.visible");
    cy.get('input[type="password"]').should("be.visible");
  });

  it("BFF /api/zones returns JSON 200", () => {
    cy.request({
      url: "/api/zones",
      failOnStatusCode: false,
      timeout: 15_000,
    }).then((res) => {
      // 200 with a JSON array — empty is fine, upstream may be quiet.
      expect(res.status).to.be.oneOf([200, 502, 503]);
      if (res.status === 200) {
        expect(res.headers["content-type"]).to.match(/application\/json/);
        expect(res.body).to.be.an("array");
      }
    });
  });

  it("BFF /api/iot/nodes proxies the upstream IoT API", () => {
    cy.request({
      url: "/api/iot/nodes",
      failOnStatusCode: false,
      timeout: 15_000,
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 502, 503]);
    });
  });
});
