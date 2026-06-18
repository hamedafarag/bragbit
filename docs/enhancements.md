# BragBit — Enhancement Backlog (side plan)

A companion to [PLAN.md](../PLAN.md). PLAN tracks the forward feature **phases** (Phase 10 = hosted
multi-tenant, Phase 11 = v2). This is the cross-cutting backlog of **quality, tech-debt, testing,
security, performance, and polish** work surfaced during the v0.1.0 build and the post-release code
review (2026-06-16). Items here are independently pickable; they don't block a release on their own.

**Priority:** P1 (do soon) · P2 (should) · P3 (nice-to-have).
**Effort:** S (< ½ day) · M (½–2 days) · L (> 2 days).

## A. Code quality & tech debt

| ID        | Pri | Effort | Enhancement                                                                                                                        | Why                                                                                                  |
| --------- | --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ENH-CQ-01 | P1  | S      | Replace the `app/page.tsx` demo mockup (318 lines of hardcoded fake brags) with a redirect to `/dashboard` or a real landing page. | The root `/` shows fabricated data to real users — the biggest smell in the codebase.                |
| ENH-CQ-02 | P3  | S      | Bump `tsconfig` `target` ES2017 → ES2022.                                                                                          | Stale create-next-app default; Node 22 / modern browsers support far newer output.                   |
| ENH-CQ-03 | P2  | M      | Decompose the largest client components (`brag-editor` 288, `share-dialog` 265) into focused sub-components.                       | Upper bound of comfortable size; smaller pieces read and test better.                                |
| ENH-CQ-04 | P3  | S      | Move domain logic (the `beforeDelete` workspace-reaping) out of `lib/auth/index.ts` into a feature module.                         | The auth config object carries real business logic inline.                                           |
| ENH-CQ-05 | P2  | M      | Create more bundle-budget headroom (now **396.21 / 400 kB** after the `/` cleanup).                                                | ~3.8 kB of slack now (was 1.3) — better, still tight; audit client JS or set the limit deliberately. |

## B. Testing

| ID          | Pri | Effort | Enhancement                                                                                | Why                                                                                                                                                              |
| ----------- | --- | ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENH-TEST-01 | P1  | M      | e2e for the core flow: capture → timeline → share (+ password) → export.                   | Today only `admin-gating` + `home` exist; core flows have no e2e — the ENH-CQ-01 redirect broke an admin-gating assertion that only surfaced at CI. Biggest gap. |
| ENH-TEST-02 | P2  | M      | e2e for the setup wizard (both modes) + invitation accept.                                 | The first-run and onboarding paths are untested end to end.                                                                                                      |
| ENH-TEST-03 | P2  | S      | A documented `pnpm test:db` that runs the DB-gated suite against the dev database locally. | They skip by default; easy local coverage would catch regressions before CI.                                                                                     |
| ENH-TEST-04 | P3  | S      | Add a QA checkbox to the PR template pointing at the [manual test plan](testing.md).       | Prompts a manual pass on user-facing PRs.                                                                                                                        |
| ENH-TEST-05 | P3  | M      | Coverage reporting + a soft threshold in CI.                                               | Visibility into what's actually exercised.                                                                                                                       |

## C. Security

| ID         | Pri | Effort | Enhancement                                                                               | Why                                                                                             |
| ---------- | --- | ------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ENH-SEC-01 | P2  | M      | Add a `script-src` Content-Security-Policy with per-request nonces.                       | The CSP intentionally omits `script-src` today; nonces close the XSS gap (needs middleware).    |
| ENH-SEC-02 | P2  | M      | Shared rate-limit store (Better Auth `secondaryStorage` / Redis-backed `lib/rate-limit`). | The in-memory limiter is single-process; multi-instance needs a shared store (Phase 10 prereq). |
| ENH-SEC-03 | P3  | S      | Trusted-proxy client-IP configuration.                                                    | Accurate per-client rate-limiting behind the reference reverse proxy.                           |
| ENH-SEC-04 | P3  | S      | `pnpm audit` in CI with an allowlist for the known dev-tool advisories.                   | Catches new prod-dependency advisories without failing on the accepted build-tool ones.         |
| ENH-SEC-05 | P2  | S      | A security-review pass + a dependency-update cadence before the repo goes public.         | Career data is sensitive; a deliberate review before public exposure.                           |

## D. Performance

| ID          | Pri | Effort | Enhancement                                                      | Why                                                                                                  |
| ----------- | --- | ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ENH-PERF-01 | P2  | L      | Timeline cursor pagination (month-windowed).                     | Deferred from Phase 5; the `(document_id, date)` index already exists. Matters at hundreds of brags. |
| ENH-PERF-02 | P3  | M      | `sharp`-downscaled thumbnails for image attachments and avatars. | Deferred Phase 4 refinement; the timeline currently serves full-res through the authorizing route.   |
| ENH-PERF-03 | P3  | S      | Review / enforce the Lighthouse CI budgets.                      | Keep Core Web Vitals honest as the app grows.                                                        |

## E. Infrastructure, CI & tooling

| ID           | Pri | Effort | Enhancement                                                                            | Why                                                                                              |
| ------------ | --- | ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| ENH-INFRA-01 | P1  | S      | Bump GitHub Actions off Node 20 (`actions/checkout@v4`, `setup-node@v4`, etc.).        | Node 20 is being force-migrated to 24 on the runners; the deprecation warning is already firing. |
| ENH-INFRA-02 | P2  | S      | Add Renovate or Dependabot.                                                            | Automated, reviewable dependency updates.                                                        |
| ENH-INFRA-03 | P3  | S      | A dedicated `/api/health` endpoint for the container health check.                     | Cleaner than hitting `/` (which renders the app).                                                |
| ENH-INFRA-04 | P3  | L      | Optional headless-Chromium PDF service (`browserless`).                                | Server-side PDF as an add-on; browser print is the deliberate v1 path.                           |
| ENH-INFRA-05 | P3  | S      | Make `seed-demo` runnable inside the container, or document the local-only constraint. | The script needs `dotenv` + `better-auth/crypto`, which aren't in the slim image.                |

## F. UX & product polish

| ID        | Pri | Effort | Enhancement                                                                           | Why                                                                          |
| --------- | --- | ------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ENH-UX-01 | P2  | L      | Dark mode — a designed ink-on-dark variant (not a mechanical invert).                 | Deferred from Phase 0; a real post-v1 enhancement.                           |
| ENH-UX-02 | P2  | M      | Accessibility pass (keyboard nav, focus management, ARIA on dialogs/forms, contrast). | No a11y audit has been done; important for an inclusive OSS tool.            |
| ENH-UX-03 | P3  | S      | Reduce the `no-img-element` eslint-disables where `next/image` can serve.             | 10 justified disables today; some non-authorizing images could be optimized. |
| ENH-UX-04 | P3  | M      | Entry content templates (action-verb scaffolds) to beat the blank page.               | Pulls a PLAN §11 item earlier; cheap capture-friction win.                   |
| ENH-UX-05 | P3  | M      | Streak + GitHub-style activity heatmap on the dashboard.                              | Drives logging cadence; pairs with the weekly reminders (PLAN §11).          |

## G. Tracked carryover

| ID        | Pri | Effort | Enhancement                                                                              | Why                                                                |
| --------- | --- | ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ENH-CO-01 | P2  | M      | Member-removal export bundle (Markdown + JSON + attachments handed to a removed member). | Phase 2 carryover; now buildable on the shipped `features/export`. |

## Tracked elsewhere (big phases — see PLAN.md)

- **Phase 10 — hosted multi-tenant (v1.1):** open signup, user-created orgs, the `/super` console,
  quota/abuse controls, the data-isolation test suite. See [PLAN.md §10](../PLAN.md).
- **Phase 11 — v2 backlog:** REST API + personal access tokens, a companion CLI (git-history brag
  extraction), SSO (OIDC/SAML), optional BYO-key AI, curated sharing, Markdown/Notion import. See
  [PLAN.md §11](../PLAN.md).

## Recommended order (highest leverage first)

1. **ENH-INFRA-01** — Node 20 → 24 in Actions (CI will break imminently otherwise). _S_
2. **ENH-CQ-01** — kill the demo root page (quick, visible correctness win). _S_
3. **ENH-TEST-01** — e2e for the core capture → share → export flow (the biggest real safety gap). _M_
4. **ENH-CQ-05 + ENH-CQ-02** — bundle headroom and the TS target (both cheap). _S–M_
5. **ENH-SEC-01 / ENH-SEC-02 / ENH-SEC-05** — before any public or hosted launch. _M_

## Done

| ID        | Done       | Notes                                                                             |
| --------- | ---------- | --------------------------------------------------------------------------------- |
| ENH-CQ-01 | 2026-06-16 | Root `/` is now a mode/session-aware redirect; the demo mockup is gone (−2.5 kB). |
