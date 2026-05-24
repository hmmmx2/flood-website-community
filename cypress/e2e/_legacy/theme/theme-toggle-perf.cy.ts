/**
 * Theme toggle should stay responsive (no multi-second jank).
 * Provider dispatches `flood-theme-change` (see useThemeTokens).
 */

describe("Theme toggle", () => {
  beforeEach(() => {
    cy.interceptBlogs();
    cy.interceptFeed();
    cy.interceptSensors();
    cy.interceptFavourites();
  });

  it("dispatches flood-theme-change after clicking the toggle", () => {
    cy.visit("/");
    cy.waitForPageLoad();
    const state = { ok: false };
    cy.window().then((win) => {
      win.addEventListener("flood-theme-change", () => {
        state.ok = true;
      });
    });
    cy.get('button[aria-label*="Switch to"]').first().click();
    cy.wrap(state).its("ok").should("eq", true);
  });

  it("toggles in under 1s from click to custom event (soft perf budget)", () => {
    cy.visit("/");
    cy.waitForPageLoad();
    cy.get('button[aria-label*="Switch to"]')
      .first()
      .then(($b) => {
        const win = $b[0].ownerDocument.defaultView!;
        const m = { start: 0, end: 0 };
        win.addEventListener(
          "flood-theme-change",
          () => {
            m.end = win.performance.now();
          },
          { once: true },
        );
        m.start = win.performance.now();
        $b[0].click();
        expect(m.end, "event received").to.be.greaterThan(0);
        expect(m.end - m.start, "flood-theme-change latency (ms)").to.be.lessThan(1000);
      });
  });
});
