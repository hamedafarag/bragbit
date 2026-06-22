# BragBit — Manual Test Plan (Phase 10, Hosted Multi-tenant v1.1)

A step-by-step manual test catalogue for the **hosted** deployment mode (`INSTANCE_MODE=hosted`) and
the Phase 10 work that ships with it: open signup, user-created organizations, the workspace switcher,
the `/super` superadmin console, the abuse controls, per-workspace branding on a shared instance, and
the timeline cursor pagination (the one Phase 10 item that applies to every mode).

This is the companion to the [Phases 1–9 plan](testing.md) — everything there (auth, documents, brags,
sharing, export, reminders) still applies inside any one workspace on a hosted instance; this document
only covers what's **new or different** in hosted mode.

## How to use this document

- Each case has an **ID**, a **priority**, the applicable **mode(s)**, and (where it helps)
  **preconditions**, **steps**, and an **expected** result.
- Run all **P1** cases before cutting a hosted release — a failing P1 is a blocker. Run P2/P3 as time
  allows.
- Record **Pass / Fail / Blocked** plus notes against each ID. Copy
  [`test-results-template.csv`](test-results-template.csv) per run, or add a `phase-10` sheet.
- **Priority:** P1 = critical · P2 = important · P3 = edge / polish.
- **Mode:** `hosted` = `INSTANCE_MODE=hosted` only · `all` = every mode (used by the pagination cases)
  · contrasts with the private modes are called out inline.
- Most of this is also covered by the automated **hosted e2e** suite (`pnpm test:e2e:hosted`,
  9 specs) and the **data-isolation** suite (`pnpm test:db`); this catalogue is the human pass over
  the same surface.

## Test environment & data

1. **Bring up a hosted instance.** Set `INSTANCE_MODE=hosted` in `.env` against a **fresh** database
   (no `/setup` owner is created in hosted mode), then `pnpm dev:up` → `pnpm db:migrate` → `pnpm dev`.
   - Set `SUPERADMIN_EMAILS` to the email you'll register as the instance admin (e.g.
     `SUPERADMIN_EMAILS=admin@bragbit.local`).
   - The abuse knobs default on: `WORKSPACE_QUOTA_MB=2048`, `BLOCK_DISPOSABLE_EMAIL=true`. Set a small
     `WORKSPACE_QUOTA_MB` (e.g. `1`) to exercise the quota cases without uploading gigabytes.
   - See [Hosting BragBit publicly](self-hosting/public-instance.md) and
     [Configuration](configuration.md).
2. **Email** — verification, invitation, and reminder mail lands in **Mailpit** (`http://localhost:8025`).
   Open signup _requires_ a working SMTP/Mailpit, since verification is mandatory.
3. **Accounts you'll need:**
   - **Superadmin** — the email in `SUPERADMIN_EMAILS` (sign it up like any other user first).
   - **User A** and **User B** — two ordinary signups, for org, switcher, and isolation cases.
4. **Reset between runs** — `docker compose -f docker-compose.dev.yml down -v && pnpm dev:up && pnpm db:migrate`
   gives a clean instance (open signup leaves real accounts behind).

---

## A. Open signup

- **TC-HS-SU-01 · Public sign-up page is reachable** — P1 · hosted
  - Steps: open `/sign-up` while signed out.
  - Expected: a working sign-up form (name, email, password). In a **private** mode `/sign-up`
    redirects to `/sign-in`.
- **TC-HS-SU-02 · Verification is required** — P1 · hosted — security
  - Steps: sign up with a fresh email; before verifying, try to sign in.
  - Expected: sign-in refused with a "verify your email" message; a verification mail is in Mailpit;
    no session.
- **TC-HS-SU-03 · Verified sign-up lands in a ready workspace** — P1 · hosted
  - Steps: open the verification link in Mailpit.
  - Expected: email verified, auto signed-in, lands on `/dashboard` in a personal workspace ready to
    log a win.
- **TC-HS-SU-04 · Duplicate email rejected** — P2 · hosted
  - Steps: sign up again with an already-registered email.
  - Expected: rejected; no second account, no second workspace.
- **TC-HS-SU-05 · No setup wizard in hosted** — P3 · hosted
  - Steps: visit `/setup` on a fresh hosted instance.
  - Expected: hosted has no first-run owner wizard — the first person just signs up. `/setup` does not
    create a workspace.

## B. Personal-workspace provisioning

- **TC-HS-PW-01 · Each signup gets its own personal workspace** — P1 · hosted
  - Expected: a brand-new account owns exactly one **personal** workspace and is its owner; the header
    shows the default BragBit brand.
- **TC-HS-PW-02 · OAuth signup also provisions** — P2 · hosted
  - Pre: `GITHUB_CLIENT_ID`/`SECRET` (or Google) configured. Steps: sign up via the provider with a
    new identity.
  - Expected: an account **and** a personal workspace are created (hosted allows OAuth to create new
    accounts, unlike the private modes).
- **TC-HS-PW-03 · Accepted invitation also provisions** — P2 · hosted
  - Steps: have User A invite a new email to an org; accept and register.
  - Expected: the invitee gets their own personal workspace **and** the org membership (the
    provisioning hook fires for every account-creation path).

## C. User-created organizations

- **TC-HS-ORG-01 · Create an organization** — P1 · hosted
  - Steps: as User A, use the header "New org" / switcher entry → `/organizations/new` → name it →
    create.
  - Expected: the org workspace is created, User A is its **owner**, and the app switches into it.
- **TC-HS-ORG-02 · A new org reuses the admin tooling** — P1 · hosted
  - Steps: in the new org, open `/admin`.
  - Expected: the owner can set branding (name/accent/logo), invite members, and manage roles — the
    Phase 1–2 flows, now usable in any org you own.
- **TC-HS-ORG-03 · Slug uniqueness** — P2 · hosted
  - Steps: create two orgs with the same display name.
  - Expected: both succeed with **distinct** slugs (the second is uniquified).
- **TC-HS-ORG-04 · Org creation is hosted-only** — P2 · hosted
  - Expected: in a private mode there is no "New org" entry and `/organizations/new` is not reachable.

## D. Workspace switcher

- **TC-HS-WS-01 · Switcher lists every workspace I belong to** — P1 · hosted
  - Pre: User A has a personal workspace + at least one org. Steps: open the header switcher.
  - Expected: all of them listed, personal first, the active one marked; "Create organization" is in
    the switcher.
- **TC-HS-WS-02 · Switching re-scopes the app** — P1 · hosted
  - Steps: switch from personal to an org.
  - Expected: the dashboard, documents, and search now show **only** the active workspace's data.
- **TC-HS-WS-03 · Switching re-themes the app** — P2 · hosted
  - Expected: the accent and logo update to the active workspace's brand on switch (see also
    TC-HS-BRAND-03).
- **TC-HS-WS-04 · Cannot switch into a workspace you don't belong to** — P1 · hosted — security
  - Steps: attempt `switchWorkspace` for an org you're not a member of (e.g. replay the action with
    another org's id).
  - Expected: refused; the active workspace is unchanged.
- **TC-HS-WS-05 · Switcher absent in private modes** — P3 · hosted
  - Expected: the private single-workspace modes show no switcher.

## E. Superadmin console (`/super`)

- **TC-HS-SUP-01 · Superadmin can open `/super`** — P1 · hosted
  - Pre: signed in as the `SUPERADMIN_EMAILS` account. Steps: open `/super`.
  - Expected: the console renders (workspaces, accounts, signups).
- **TC-HS-SUP-02 · Everyone else gets 404** — P1 · hosted — security
  - Steps: open `/super` as an ordinary user, and again signed out.
  - Expected: **404** in both cases (the route doesn't advertise its existence).
- **TC-HS-SUP-03 · Lists workspaces, accounts, and signups** — P1 · hosted
  - Expected: per-workspace member count, storage quota, and suspension state; the account/signup
    feed.
- **TC-HS-SUP-04 · No brag content ever leaks** — P1 · hosted — security
  - Steps: scan every `/super` view.
  - Expected: only operational metadata — **no** document titles, brag titles, or brag bodies anywhere.
- **TC-HS-SUP-05 · Per-workspace quota override** — P2 · hosted
  - Steps: set a workspace's quota in `/super`.
  - Expected: that value becomes the workspace's effective quota (overriding `WORKSPACE_QUOTA_MB`);
    feeds TC-HS-QUOTA-03.

## F. Suspension enforcement

- **TC-HS-SUSP-01 · Suspending a workspace freezes it** — P1 · hosted
  - Steps: in `/super`, suspend a workspace; then, as a member of it, try to use the app.
  - Expected: members of that workspace are bounced to `/suspended`; data is untouched (not deleted).
- **TC-HS-SUSP-02 · Suspending an account freezes the user** — P1 · hosted
  - Steps: suspend User B; have User B try to use the app.
  - Expected: User B is frozen out (bounced to `/suspended`), across all their workspaces.
- **TC-HS-SUSP-03 · Un-suspend restores access** — P2 · hosted
  - Expected: clearing the suspension in `/super` lets the workspace/account back in.

## G. Abuse controls — rate limiting (shared store, ENH-SEC-02)

- **TC-HS-RL-01 · Sign-in / sign-up is rate-limited** — P1 · hosted — security
  - Steps: hammer sign-in (or sign-up) past the limit (3/10s on those endpoints).
  - Expected: further attempts are throttled with a rate-limit error, then recover after the window.
- **TC-HS-RL-02 · Limit is shared across app instances** — P2 · hosted
  - Pre: two app containers against one Postgres. Steps: spread attempts across both.
  - Expected: the limit is **global**, not per-container (the limiter state lives in Postgres in
    hosted mode). Single-container instances rely on this implicitly.
- **TC-HS-RL-03 · Real client IP behind a proxy** — P2 · hosted — security
  - Pre: behind a reverse proxy; set `TRUSTED_PROXY_IP_HEADER` if it isn't `X-Forwarded-For`.
  - Expected: the limit counts the real client IP, not the proxy's (so one abuser can't be masked, and
    real users aren't collectively limited).

## H. Abuse controls — storage quota

- **TC-HS-QUOTA-01 · Upload over quota is refused** — P1 · hosted
  - Pre: set a small `WORKSPACE_QUOTA_MB` (e.g. `1`) and fill the workspace near it. Steps: upload an
    attachment that would exceed the quota.
  - Expected: the upload is rejected with **413** (Payload Too Large / over quota); nothing is stored.
- **TC-HS-QUOTA-02 · Upload under quota succeeds** — P1 · hosted
  - Expected: a normal attachment upload (within quota and `MAX_UPLOAD_MB`) works.
- **TC-HS-QUOTA-03 · Per-workspace override is honored** — P2 · hosted
  - Pre: TC-HS-SUP-05 set a higher/lower override. Expected: the effective limit follows the override,
    not the instance default.
- **TC-HS-QUOTA-04 · Quota only enforced in hosted** — P2 · hosted
  - Expected: the private modes do not enforce a per-workspace storage quota.

## I. Abuse controls — disposable email

- **TC-HS-DISP-01 · Disposable domain blocked at sign-up** — P1 · hosted — security
  - Steps: sign up with a known throwaway domain (e.g. `mailinator.com`).
  - Expected: rejected **before** any account is created; no verification mail sent.
- **TC-HS-DISP-02 · A normal domain is allowed** — P1 · hosted
  - Expected: a real domain signs up normally.
- **TC-HS-DISP-03 · Blocking can be turned off** — P2 · hosted
  - Pre: `BLOCK_DISPOSABLE_EMAIL=false`. Expected: a disposable domain is then accepted.

## J. Per-workspace branding (shared instance)

- **TC-HS-BRAND-01 · An organization self-brands** — P1 · hosted
  - Pre: an org with a custom accent/logo. Steps: view the app and a share page while in that org.
  - Expected: the org's accent (`--primary`) and logo theme the app and its public share pages.
- **TC-HS-BRAND-02 · Personal workspace uses the instance default** — P2 · hosted
  - Expected: a personal workspace shows the default BragBit accent (`#e8590c`), not an org's brand.
- **TC-HS-BRAND-03 · Switching re-themes live** — P2 · hosted
  - Steps: switch between two differently-branded orgs (and the personal workspace).
  - Expected: the accent/logo change immediately on switch — no stale brand from the previous
    workspace.
- **TC-HS-BRAND-04 · Pre-sign-in pages use the default brand** — P3 · hosted
  - Expected: `/sign-in`, `/sign-up`, and other logged-out pages wear the BragBit default (no
    workspace is active yet).

## K. Cross-workspace data isolation (spot-check)

> Fully covered by the automated suite (`src/test/data-isolation.test.ts`); these are quick manual
> confirmations. Documents are private **per user** even within a shared organization.

- **TC-HS-ISO-01 · Another workspace's document is unreachable** — P1 · hosted — security
  - Steps: as User B, open `/documents/<User A's document id>` directly.
  - Expected: **404** — never User A's content.
- **TC-HS-ISO-02 · Another workspace's attachment is unreachable** — P1 · hosted — security
  - Steps: as User B, request User A's attachment URL (`/api/files/...`).
  - Expected: denied; the file is not served.
- **TC-HS-ISO-03 · Search and dashboard are scoped** — P1 · hosted — security
  - Expected: User B's search and dashboard activity never include User A's brags.
- **TC-HS-ISO-04 · Export and share-link ops are scoped** — P1 · hosted — security
  - Steps: as User B, try to export or manage a share link for User A's document.
  - Expected: refused / 404; no cross-tenant data crosses over.

## L. Timeline cursor pagination (PERF-01)

> Applies to **every** mode — it's a Phase 10 deliverable but not hosted-specific. Use a document with
> enough brags across several months to exceed one page (~30 brags, whole months). The demo seed is
> small; back-fill brags or reuse the hosted e2e fixture shape (e.g. 16 + 16 + a few older).

- **TC-HS-PAGE-01 · First page loads a recent window** — P1 · all
  - Steps: open a long document's timeline.
  - Expected: the most recent months render with a **"Load more"** control; clearly-older months are
    not present yet.
- **TC-HS-PAGE-02 · "Load more" appends older months** — P1 · all
  - Steps: click "Load more".
  - Expected: the next older window appends below; **no month header is duplicated** across the
    boundary; scroll position is preserved (the prior months don't re-render).
- **TC-HS-PAGE-03 · Quiet-month marker across the page boundary** — P2 · all
  - Pre: a quiet (empty) month sits between the last loaded month and the next older one. Steps: load
    more.
  - Expected: the "N quiet months" marker appears correctly between the two pages (not before loading,
    not duplicated).
- **TC-HS-PAGE-04 · Filters reset and paginate** — P2 · all
  - Steps: with several pages loaded, apply a category/tag/date filter; then page through.
  - Expected: the view resets to the first page of the **filtered** set; "Load more" reflects only
    matching brags; clearing the filter resets again.
- **TC-HS-PAGE-05 · Short document shows everything, no control** — P2 · all
  - Expected: a document under the window renders all its brags with **no** "Load more" button.
- **TC-HS-PAGE-06 · A heavy single month is not split** — P3 · all
  - Pre: one month holds more than a page's worth of brags. Expected: that month loads **whole** in a
    single page (a month header never splits across loads).
- **TC-HS-PAGE-07 · Public share timeline unaffected** — P3 · all
  - Steps: open a shared document's public `/share/[token]` timeline.
  - Expected: the share page renders the full timeline as before (it is not paginated); pagination is
    the owner view only.

---

## Appendix — Hosted smoke test (v1.1 release acceptance)

A fast end-to-end pass on a **fresh** hosted instance (`INSTANCE_MODE=hosted`, `SUPERADMIN_EMAILS`
set).

1. Sign up as the superadmin email → verify via Mailpit → land in a personal workspace.
2. Open `/super` (works for the superadmin); confirm an ordinary user gets 404 there.
3. Sign up as User A (normal domain) → verify → personal workspace ready; confirm a **disposable**
   domain is rejected at sign-up.
4. As User A, create an organization → become owner → set its brand → invite User B.
5. Accept as User B → User B has a personal workspace **and** the org membership; switch between them
   and watch the brand re-theme.
6. Confirm User B cannot open User A's personal document by id (404).
7. In `/super`, suspend User A's org → its members bounce to `/suspended`; un-suspend → restored.
8. With a small `WORKSPACE_QUOTA_MB`, confirm an over-quota upload returns 413.
9. On a long document, confirm "Load more" pages in older months with correct gap markers.
