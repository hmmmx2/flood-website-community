# FloodWatch Community — Cypress E2E Coverage

**Suite:** `cypress/e2e/community/**/*.cy.ts`
**Run mode:** headless, fully mocked (no backend)
**Result:** ✅ **76/76 passing · 18 specs** · `tsc --noEmit` clean (strict, no `any`)

```
npx cypress run --e2e --spec "cypress/e2e/community/**/*.cy.ts"
  All specs passed!   01:16   76   76   -   -   -
```

## How it works (deterministic, backend-free)

- **Auth is fully mocked.** `cy.loginViaMock()` (in `cypress/support/commands.ts`):
  1. intercepts `GET /api/auth/session` so client `useSession()` resolves to an authenticated customer;
  2. mints a **real signed NextAuth (Auth.js v5) JWT cookie** via the `signSession` node task (`cypress.config.ts`, reads `AUTH_SECRET` from `.env.local`) so the edge middleware (`proxy.ts`) lets the SSR-gated `/settings` route through;
  3. caches the cookie across specs via `cy.session({ cacheAcrossSpecs: true })`.
- **Ambient noise is silenced** in `cy.stubAmbient()` (global `beforeEach`): health check, both SSE streams (`/api/sse/iot-events`, `/api/sse/notifications`), notification polling, and a default **unauthenticated** session (`null`).
- **No hard waits.** Every intercept is aliased and awaited with `cy.wait('@alias')`; assertions retry on DOM state.
- **Resilient selectors.** `data-cy` hooks added to source (see below); otherwise accessible role/label/text.
- **Hydration gate.** Anonymous form pages wait for the `SessionProvider` session fetch (`@anonSession`) before interacting, eliminating pre-hydration keystroke loss.

## Route × feature coverage

| Route | Spec | Key assertions |
|---|---|---|
| Gate (`/settings`, `/register`, `/`) | `auth-gate.cy.ts` (4) | unauth `/settings`→`/login`; signed-cookie `/settings` reachable; authed `/register`→`/`; public feed CTA |
| `/` feed | `feed.cy.ts` (9) | compose bar, posts render, end-of-feed, sort=top query, search query, Load-more pagination, Ctrl+K search modal (post nav, no-results, group match), anon CTA |
| `/` create post | `feed-create-post.cy.ts` (6) | modal open, submit-disabled gating, group select + drop-zone, create → prepend, whitespace validation, cancel |
| `/` interactions | `feed-interactions.cy.ts` (4) | optimistic like + reconcile, like rollback on 500, comments deep-link, Share modal permalink |
| `/login` | `login.cy.ts` (6) | form + links, password toggle, invalid-creds banner, success→`/`, register view toggle, forgot-password nav |
| `/register` | `register.cy.ts` (6) | fields, mismatch disables submit, toggle, <8-char reject, success→`/verify-email`, **devCode never in URL (P1-2)** |
| `/verify-email` | `verify-email.cy.ts` (4) | 6 OTP boxes, enable-on-complete, verify→sign-in, resend code |
| `/forgot-password` | `forgot-password.cy.ts` (3) | form, send code → confirmation, route to reset |
| `/reset-password` | `reset-password.cy.ts` (4) | code step, advance to new-password, mismatch reject, reset → success |
| `/settings` (4 tabs) | `settings.cy.ts` (5) | profile populate + save, password validate + change, notification channel toggle persist, account tab |
| `/flood-map` | `flood-map.cy.ts` (5) | header + zone counts, **level-status legend (Normal/Alert/Warning/Critical)**, legend filter, search filter, connection-error retry |
| `/blog` | `blog.cy.ts` (5) | header + tabs + cards, featured hero, category query, client search + empty state, card nav |
| `/blog/[id]` | `blog-detail.cy.ts` (2) | article render + back link, not-found state |
| `/post/[id]` | `post-detail.cy.ts` (3) | full post + comments section, like from detail, not-found |
| `/g/[slug]` | `groups.cy.ts` (3) | banner + stats + posts, join→Leave toggle, not-found |
| `/u/[id]` | `profile.cy.ts` (3) | own profile + edit affordance, other member (no edit), not-found |
| `/feedback` | `feedback.cy.ts` (2) | anon sign-in CTA, authed UAT survey renders |
| Notifications bell | `notifications.cy.ts` (2) | dropdown list + settings link, mark-all-read |

## `data-cy` hooks added to source (no behaviour change)

`components/Navbar.tsx`, `PostCard.tsx`, `CreatePostModal.tsx`, `SearchModal.tsx`, `ShareModal.tsx`, `NotificationBell.tsx`; `app/page.tsx` (feed), `app/login`, `app/register`, `app/verify-email`, `app/reset-password`, `app/forgot-password`, `app/settings`, `app/flood-map`, `app/g/[slug]`.

## Quarantined legacy specs

The previous (auth-model-mismatched) specs + page objects were moved to `cypress/e2e/_legacy/` and excluded from `specPattern` + `tsconfig` — nothing deleted.

## Reproduce

```bash
# 1. Start the Community dev server (Windows note: start-server-and-test is broken — run dev directly)
node --max-http-header-size=65536 node_modules/next/dist/bin/next dev --port 3002

# 2. In another shell
npx cypress run --e2e --spec "cypress/e2e/community/**/*.cy.ts"
npx tsc --noEmit -p cypress/tsconfig.json
```
