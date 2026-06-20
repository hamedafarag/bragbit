# BragBit — Manual Test Plan (v0.1.1, Phases 1–9)

A step-by-step manual test catalogue for the v1 (self-host) scope: the two private deployment modes,
`private-solo` and `private-org`. Hosted multi-tenant mode (`INSTANCE_MODE=hosted`) is v1.1 and is
out of scope here.

## How to use this document

- Each case has an **ID**, a **priority**, the applicable **mode(s)**, **preconditions**, **steps**,
  and an **expected** result.
- Run all **P1** cases before any release — a failing P1 is a release blocker. Run P2/P3 as time
  allows.
- Record **Pass / Fail / Blocked** plus notes against each ID. A blank results sheet listing every
  case is at [`test-results-template.csv`](test-results-template.csv) — copy it per test run (it
  opens in any spreadsheet and renders as a table on GitHub).
- **Priority:** P1 = critical · P2 = important · P3 = edge / polish.
- **Mode:** `solo` = `private-solo` · `org` = `private-org` · `both` = applies to both.

## Test environment & data

1. **Bring up an instance.**
   - _Dev:_ `pnpm dev:up` (Postgres + Mailpit + MinIO) → `pnpm db:migrate` → `pnpm dev`
     (`http://localhost:3000`).
   - _Docker:_ follow [self-hosting/docker-compose.md](self-hosting/docker-compose.md).
2. **Pick the mode** with `INSTANCE_MODE` in `.env` before first run. Testing both modes needs **two
   fresh databases** (the setup wizard runs once per database). To reset the dev DB:
   `docker compose -f docker-compose.dev.yml down -v && pnpm dev:up && pnpm db:migrate`.
3. **Email** — in dev, all mail (verification, invitations, reset, reminders) lands in **Mailpit**
   at `http://localhost:8025`. The API: `curl http://localhost:8025/api/v1/messages`.
4. **Sample data (optional)** — `pnpm seed:demo` seeds a populated workspace; sign in as
   `demo@bragbit.local` / `demobragbit`. Use this for read-only timeline/share/export checks; use a
   **fresh** DB for the setup/auth flows.
5. **Two accounts** — for org-mode and isolation tests you need a second account (invite one, or seed
   one). Keep an "owner", an "admin", and a "member" handy in org mode.
6. **Time-bound flows** — the timing/limit knobs are env-tunable (defaults match production). Set a
   short `INVITATION_TTL_DAYS` or `AUTH_TOKEN_TTL_MINUTES`, or `RATE_LIMIT_ENABLED=true`, to exercise
   the expiry/rate-limit cases (TC-INV-04, TC-INV-09, TC-SEC-02, reminders) without waiting out the
   defaults; revert afterwards. See [Configuration](configuration.md).

---

## A. First-run setup (`/setup`)

- **TC-SETUP-01 · Fresh instance forces setup** — P1 · both
  - Pre: fresh DB, no workspace. Steps: open any URL (`/`, `/dashboard`).
  - Expected: redirected to `/setup`.
- **TC-SETUP-02 · Solo setup creates a personal workspace** — P1 · solo
  - Steps: complete the wizard (name, email, password, workspace name, optional accent).
  - Expected: owner created + signed in, lands on `/dashboard`; **no** members/invitations/roles UI
    anywhere in the app.
- **TC-SETUP-03 · Org setup creates an organization workspace** — P1 · org
  - Expected: as above, but the workspace is an organization and `/admin` exposes the Members tab.
- **TC-SETUP-04 · Setup token gate** — P2 · both
  - Pre: `SETUP_TOKEN` set. Steps: submit with no / wrong token, then the correct token.
  - Expected: wrong/empty → "Invalid setup token"; correct → succeeds.
- **TC-SETUP-05 · Setup closes permanently** — P1 · both
  - Pre: a workspace already exists. Steps: navigate to `/setup`.
  - Expected: bounced off `/setup` (you can't reach the wizard or create a second workspace).
- **TC-SETUP-06 · Root routes a signed-out visitor to sign-in** — P2 · both
  - Pre: the instance is set up. Steps: open `/` while signed out.
  - Expected: redirected to `/sign-in` (the root renders no page of its own — it's a dispatcher).
- **TC-SETUP-07 · Root routes a signed-in visitor to the dashboard** — P2 · both
  - Pre: the instance is set up. Steps: sign in, then open `/`.
  - Expected: redirected to `/dashboard`.

## B. Authentication

- **TC-AUTH-01 · Sign in with valid credentials** — P1 · both
  - Expected: redirected to `/dashboard`; header shows the workspace name/logo.
- **TC-AUTH-02 · Verification required before sign-in** — P1 · both
  - Pre: a registered but **unverified** account. Steps: try to sign in.
  - Expected: refused with a "verify your email" message; no session.
- **TC-AUTH-03 · Wrong password rejected** — P1 · both — Expected: generic error, no session.
- **TC-AUTH-04 · Verify email via link** — P1 · both
  - Steps: register → open the verification mail in Mailpit → click the link.
  - Expected: email marked verified; sign-in now works (auto sign-in after verification).
- **TC-AUTH-05 · Resend verification** — P2 · both
  - Steps: at `/verify-email`, request a new link. Expected: a fresh mail arrives; it verifies.
- **TC-AUTH-06 · Forgot → reset password** — P1 · both
  - Steps: "Forgot password?" → open reset mail → set a new password → sign in.
  - Expected: reset succeeds; the new password works; the old one does not.
- **TC-AUTH-07 · Reset link is single-use / time-bound** — P2 · both
  - Expected: a used or expired reset link is rejected.
- **TC-AUTH-08 · OAuth button appears only when configured** — P2 · both
  - Pre: configure `GITHUB_CLIENT_ID`/`SECRET` (or Google). Expected: a "Continue with…" button
    appears only when both halves are set.
- **TC-AUTH-09 · OAuth signs in existing accounts only (private modes)** — P2 · both
  - Steps: attempt OAuth with an identity whose email has no account.
  - Expected: it does **not** create an account; it only links/sign-ins an existing verified email.
- **TC-AUTH-10 · Sign out** — P1 · both — Expected: session cleared; protected routes bounce to
  `/sign-in`.
- **TC-AUTH-11 · Public sign-up disabled (private modes)** — P1 · both — security
  - Steps: in a private mode, `POST /api/auth/sign-up/email` with a fresh email/password.
  - Expected: rejected (403 `EMAIL_PASSWORD_SIGN_UP_DISABLED`), **no** account created and **no**
    verification email sent. The setup wizard and invitation-accept still create accounts (they call
    `auth.api.signUpEmail` server-side, which bypasses the route guard). Hosted mode keeps open
    sign-up.

## C. Profile & account settings

- **TC-ACCT-01 · Edit profile** — P2 · both
  - Steps: at `/profile`, set display name, role title, team, bio; save.
  - Expected: saved; display name is reflected on chrome and on shared documents.
- **TC-ACCT-02 · Avatar upload** — P2 · both
  - Steps: upload a PNG/JPEG/WebP/GIF ≤ 5 MB. Expected: avatar shows; an oversized/wrong-type file is
    rejected.
- **TC-ACCT-03 · Avatar is session-gated** — P2 · both — security
  - Steps: copy an avatar's `/api/files/…` URL; open it logged out / as a non-member.
  - Expected: not served (only members of the key's workspace).
- **TC-ACCT-04 · Change email — two-step confirm (current inbox + new address)** — P1 · both
  - Steps: request a new email → click the **confirmation** link sent to the **current** address →
    then click the **verification** link sent to the **new** address.
  - Expected: a confirmation goes to the current inbox; clicking it does **not** yet change the email
    but triggers a verification mail to the new address; the change applies **only after** the new
    address is also verified. (Better Auth confirms both endpoints — the current owner approves and
    the new address is proven reachable.)
- **TC-ACCT-05 · Change password revokes other sessions** — P1 · both
  - Steps: sign in on two browsers; change the password on one. Expected: the other session is
    signed out.
- **TC-ACCT-06 · Delete account** — P1 · both
  - Expected: account + its data removed; in **solo** mode the sole-member workspace is dropped and
    the instance returns to first-run setup.

## D. Invitations (organizations)

- **TC-INV-01 · Admin invites by email + role** — P1 · org
  - Steps: `/admin/members` → invite an address as Member/Admin. Expected: a branded invite mail
    arrives in Mailpit with a tokenized link.
- **TC-INV-02 · Accept invitation** — P1 · org
  - Steps: open the link → set name + password → accept. Expected: account is **bound to the invited
    email**, pre-verified, signed in, and is now a workspace member.
- **TC-INV-03 · No account without a valid token** — P1 · org — security
  - Steps: try to reach a registration form without an invite token (there is no open sign-up).
  - Expected: impossible — only a valid, unexpired, unused token reaches the accept page.
- **TC-INV-04 · Expired invitation rejected** — P2 · org — Expected: an invite older than 7 days
  shows "invalid / expired".
- **TC-INV-05 · Used invitation not reusable** — P2 · org — Expected: a second use is rejected.
- **TC-INV-06 · Re-invite revokes the prior token** — P2 · org — Expected: inviting the same address
  again invalidates the previous link.
- **TC-INV-07 · Resend pending invitation** — P3 · org — Expected: a fresh mail is sent.
- **TC-INV-08 · Revoke pending invitation** — P2 · org — Expected: the link stops working.
- **TC-INV-09 · Accept attempts are rate-limited** — P2 · org — security
  - Steps: submit the accept/register form many times for one invitation.
  - Expected: blocked after ~8 attempts in 10 minutes with a "try again later" message.

## E. Workspace administration & branding

- **TC-ADMIN-01 · Set workspace name** — P2 · both — Expected: reflected in chrome, sign-in, shares.
- **TC-ADMIN-02 · Set accent color** — P2 · both — Expected: validated hex with live preview;
  re-themes the app (buttons/links/highlights).
- **TC-ADMIN-03 · Upload a logo** — P2 · both — Expected: replaces the wordmark in chrome + sign-in.
- **TC-ADMIN-04 · Branding on pre-auth pages** — P1 · both — Expected: the sign-in page shows the
  workspace name/logo/accent.
- **TC-ADMIN-05 · Branding on the public share page** — P1 · both — Expected: a share reflects the
  document's workspace brand.
- **TC-ADMIN-06 · Branding in emails** — P2 · org — Expected: invitations carry the inviting org's
  brand; transactional mail (verify/reset/change-email) uses the instance brand.
- **TC-ADMIN-07 · Invalid accent rejected** — P3 · both — Expected: a non-hex value is refused.
- **TC-ADMIN-08 · Personal workspace branding** — P3 · solo — Expected: a solo owner can still set
  name/accent/logo (for client-facing shares), with no member surface.

## F. Members management (organizations)

- **TC-MEM-01 · Member list** — P2 · org — Expected: each member's role, join date, and last activity.
- **TC-MEM-02 · Invite multiple at once** — P2 · org — Expected: several addresses invited in one go.
- **TC-MEM-03 · Change a member's role** — P2 · org — Expected: Member ↔ Admin updates.
- **TC-MEM-04 · Remove a member** — P1 · org — Expected: they lose workspace access immediately.
- **TC-MEM-05 · Owner protection** — P1 · org — security
  - Expected: an admin can never demote/remove the owner; nobody can remove themselves via these
    controls; only the owner can change the owner role.
- **TC-MEM-06 · Transfer ownership** — P1 · org
  - Steps: owner hands ownership to another member. Expected: atomic swap — the new owner is owner,
    the old owner becomes admin, exactly one owner remains.
- **TC-MEM-07 · Members can't reach admin** — P1 · org — security
  - Steps: as a Member, open `/admin` and `/admin/members`. Expected: redirected away — straight to
    `/dashboard` in a single redirect (not bounced via `/`; ENH-CQ-06).
- **TC-MEM-08 · No member surface in solo mode** — P1 · solo — Expected: no Members tab, no
  `/admin/members`.
- **TC-MEM-09 · Admins cannot read member brag content** — P1 · org — security
  - Expected: there is **no** UI path for an admin/owner to view another member's documents or brags.
- **TC-MEM-10 · Removed member lands on a terminal page (no redirect loop)** — P1 · org
  - Steps: remove a member, then sign in as them (the account still exists, but it has no workspace).
  - Expected: they land on `/no-workspace` (a "No workspace access" page with a sign-out), **not** a
    `/dashboard → / → /dashboard` redirect loop; sign-out recovers. A user who _does_ have a
    workspace is never stranded there.
- **TC-MEM-11 · Member removal hands over a data bundle** — P2 · org
  - Steps: remove a member who has logged data; check their inbox (Mailpit).
  - Expected: a branded email arrives with their full export attached — `bragbit-data.json` (every
    document + brag, private included), a combined `bragbit-wins.md`, and their uploaded attachment
    files (up to a size cap; oversized ones listed in the JSON). Best-effort: a mail failure never
    blocks the removal.

## G. Documents

- **TC-DOC-01 · Create with a title only** — P1 · both — Expected: appears on `/dashboard`.
- **TC-DOC-02 · Create with period + Markdown goals** — P2 · both — Expected: period and rendered
  goals show on the document page.
- **TC-DOC-03 · Edit a document** — P2 · both.
- **TC-DOC-04 · Archive (reversible)** — P2 · both — Expected: drops out of the active list into a
  restorable "Archived" disclosure.
- **TC-DOC-05 · Unarchive** — P2 · both.
- **TC-DOC-06 · Delete** — P1 · both — Expected: removed; its brags are cascaded away.
- **TC-DOC-07 · Documents are private per user** — P1 · both — security
  - Steps: as user B, try to open user A's document URL. Expected: not-found (no cross-user access),
    even for an admin.
- **TC-DOC-08 · Unknown/unowned id** — P2 · both — Expected: in-chrome "not found".

## H. Brags — capture & editor

- **TC-BRAG-01 · Quick-add (title only)** — P1 · both — Expected: logs a brag dated today in < 30s.
- **TC-BRAG-02 · `n` shortcut** — P3 · both — Expected: focuses the quick-add bar from anywhere on
  the page.
- **TC-BRAG-03 · Full editor fields** — P1 · both — Expected: date, category (8-color taxonomy),
  status (shipped/in-progress), impact, collaborators, attribution all save and render.
- **TC-BRAG-04 · Multiple labeled links** — P2 · both — Expected: add/remove/order links; they render
  as external-link chips opening in a new tab.
- **TC-BRAG-05 · Markdown is sanitized** — P1 · both — security
  - Steps: put raw HTML / `<script>` / a `javascript:` link in the description; preview + save.
  - Expected: rendered safely — no raw HTML executes, dangerous URLs are stripped.
- **TC-BRAG-06 · Edit a brag** — P2 · both.
- **TC-BRAG-07 · Delete a brag** — P2 · both — Expected: its links, tags, and attachments cascade.
- **TC-BRAG-08 · Empty-state onboarding** — P3 · both — Expected: a back-fill prompt on a document
  with no brags.

## I. Attachments & storage

- **TC-ATT-01 · Upload (multi-file)** — P1 · both — Expected: images/PDFs/office docs attach to a
  saved brag and show as paperclip chips.
- **TC-ATT-02 · Size cap** — P2 · both — Expected: a file over `MAX_UPLOAD_MB` is rejected.
- **TC-ATT-03 · MIME allowlist (whole batch)** — P2 · both — Expected: a disallowed type rejects the
  entire batch (no partial upload).
- **TC-ATT-04 · Thumbnails + size** — P3 · both — Expected: image thumbnail vs file icon; size shown
  in the editor/detail.
- **TC-ATT-05 · Download** — P2 · both — Expected: owner downloads with the correct filename + type.
- **TC-ATT-06 · Delete** — P2 · both — Expected: row + stored object removed.
- **TC-ATT-07 · Never publicly addressable** — P1 · both — security
  - Steps: copy an attachment `/api/files/…` URL; open logged out / as another user.
  - Expected: blocked (owner-only, unless via a valid share token — see TC-SHARE-13).
- **TC-ATT-08 · S3 storage** — P2 · both
  - Pre: `STORAGE_DRIVER=s3` + MinIO (`docker compose --profile minio up`). Expected: upload/download
    work against S3.

## J. Timeline, tags, filters & search

- **TC-TL-01 · Month-grouped timeline** — P1 · both — Expected: newest-first, sticky month headers,
  per-month counts, vertical spine.
- **TC-TL-02 · Status node + pill** — P2 · both — Expected: solid node = shipped, hollow =
  in-progress, with an "In progress" pill.
- **TC-TL-03 · Private card treatment** — P2 · both — Expected: dashed border + hatch + "Private"
  badge on private brags (owner view).
- **TC-TL-04 · Detail view** — P2 · both — Expected: clicking a title opens rendered Markdown,
  attachments (with image previews), links, collaborators, tags.
- **TC-TAG-01 · Inline tags** — P2 · both — Expected: type-to-add, reused across brags, monochrome
  `#name` chips; autocomplete from existing tags.
- **TC-FILTER-01 · Filter by category / tag / date range** — P2 · both — Expected: the timeline
  re-renders; the URL updates (shareable); "Clear" resets.
- **TC-FILTER-02 · Gap months** — P3 · both — Expected: quiet months between entries are marked.
- **TC-SEARCH-01 · Global full-text search** — P1 · both — Expected: the header search finds brags
  across your documents in the workspace.
- **TC-SEARCH-02 · Deep-link** — P2 · both — Expected: a result links straight to the brag in its
  document.
- **TC-SEARCH-03 · Search isolation** — P1 · both — security — Expected: results never include other
  users'/workspaces' brags.

## K. Sharing

- **TC-SHARE-01 · Create + copy a link** — P1 · both — Expected: a secret read-only URL; copy works.
- **TC-SHARE-02 · Public view** — P1 · both — Expected: `/share/[token]` renders a branded,
  month-grouped, login-free timeline.
- **TC-SHARE-03 · Private brags absent** — P1 · both — security — Expected: brags marked private do
  **not** appear in the share or its win count.
- **TC-SHARE-04 · Footer + noindex** — P3 · both — Expected: "Powered by BragBit" footer; the page is
  `noindex`.
- **TC-SHARE-05 · Last opened** — P3 · both — Expected: the owner sees when the link was last opened.
- **TC-SHARE-06 · Rotate** — P1 · both — Expected: the old URL 404s the instant a new one is minted.
- **TC-SHARE-07 · Revoke** — P1 · both — Expected: the link stops working (friendly 404).
- **TC-SHARE-08 · One active link per document** — P2 · both — Expected: creating again returns the
  existing active link.
- **TC-SHARE-09 · Password locks content** — P1 · both — security — Expected: a protected link shows
  an unlock gate that reveals **nothing** about the document (no title/brags).
- **TC-SHARE-10 · Correct password unlocks** — P1 · both — Expected: content shows; the unlock is
  remembered on that device (httpOnly cookie).
- **TC-SHARE-11 · Wrong password + rate limit** — P1 · both — security — Expected: wrong is rejected;
  after ~5 attempts the share is rate-limited.
- **TC-SHARE-12 · Password change invalidates the cookie** — P2 · both — Expected: changing/removing
  the password forces a re-unlock.
- **TC-SHARE-13 · Attachments over a share** — P1 · both — security — Expected: a shared brag's
  attachment streams via the token; a private brag's attachment is blocked; a password-gated share
  also requires the unlock cookie.
- **TC-SHARE-14 · Per-brag visibility toggle** — P2 · both — Expected: toggling Private updates the
  card treatment and removes it from shares/exports.

## L. Export

- **TC-EXP-01 · Markdown export** — P1 · both — Expected: a clean `.md` with metadata, goals, brags
  grouped by month, links, an attachment manifest, collaborators, and tags.
- **TC-EXP-02 · Include-private choice** — P1 · both — security — Expected: private brags are
  **excluded by default**; the opt-in includes them in your own copy.
- **TC-EXP-03 · Print view** — P2 · both — Expected: `/print/[documentId]` is branded, with each
  month on its own printed page.
- **TC-EXP-04 · Save as PDF** — P3 · both — Expected: the browser's print-to-PDF produces a clean
  document.
- **TC-EXP-05 · JSON export** — P1 · both — Expected: Settings → Download JSON exports every document
  (archived included) and brag (private included) with links, attachment metadata, and tags.
- **TC-EXP-06 · Export is owner-only** — P1 · both — security — Expected: the export routes refuse a
  non-owner (401) and 404 an unowned/missing id.

## M. Reminders

- **TC-REM-01 · Opt in** — P2 · both — Steps: Settings → enable weekly reminders, pick a day + IANA
  time zone. Expected: saved.
- **TC-REM-02 · Reminder email** — P2 · both
  - Steps: trigger a send (`POST /api/cron/reminders` with the `CRON_SECRET`, or wait for the in-process
    tick). Expected: a workspace-branded "What did you ship this week?" mail with a quick-add deep
    link arrives in Mailpit.
- **TC-REM-03 · Dedup** — P2 · both — Expected: triggering twice in the same window does not send a
  second mail to the same user.
- **TC-REM-04 · One-click unsubscribe** — P1 · both — Expected: the email's unsubscribe link disables
  reminders without a login (a GET only renders a confirm; a POST disables).
- **TC-REM-05 · Invalid unsubscribe token** — P2 · both — security — Expected: a tampered token is
  rejected.
- **TC-REM-06 · Cron route is secured** — P1 · both — security — Expected: `POST /api/cron/reminders`
  without the correct `Authorization: Bearer <CRON_SECRET>` is refused (and 503 if unconfigured).

## N. Deployment & operations (Phase 9)

- **TC-DEPLOY-01 · One-command stack** — P1 — Steps: `cp .env.example .env` (set the basics) →
  `docker compose up -d`. Expected: app + Postgres become healthy.
- **TC-DEPLOY-02 · Migrations on start** — P1 — Expected: `docker compose logs app` shows the migrate
  step before the server starts; the schema exists on a fresh DB.
- **TC-DEPLOY-03 · First-run wizard** — P1 — Expected: visiting the app redirects to `/setup`.
- **TC-DEPLOY-04 · MinIO profile** — P2 — Steps: `docker compose --profile minio up -d` with
  `STORAGE_DRIVER=s3`. Expected: attachments use S3.
- **TC-DEPLOY-05 · Fail-fast on bad config** — P2 — Steps: remove `BETTER_AUTH_SECRET` / break
  `DATABASE_URL`. Expected: the app refuses to boot with a clear error.
- **TC-DEPLOY-06 · Data persists** — P2 — Steps: `docker compose down` then `up -d`. Expected: data
  survives (named volumes).
- **TC-DEPLOY-07 · Backup & restore** — P2 — Follow
  [backup-and-upgrades.md](self-hosting/backup-and-upgrades.md); restore into a fresh DB and confirm
  the data is intact.
- **TC-DEPLOY-08 · Upgrade** — P2 — Steps: pull a new build → `docker compose up -d --build`.
  Expected: migrations apply on start; the app comes back healthy.
- **TC-DEPLOY-09 · Demo seed** — P3 — Steps: `pnpm seed:demo`. Expected: sign in as
  `demo@bragbit.local` / `demobragbit` and see a populated "2026" document.
- **TC-DEPLOY-10 · Health endpoint** — P2 — Steps: `curl -i http://<host>/api/health`, then again
  with Postgres stopped. Expected: 200 `{"status":"ok"}` when the app and database are reachable;
  503 `{"status":"error"}` when the DB is unreachable. Unauthenticated and returns no instance data;
  the Compose `app` healthcheck (and any external uptime monitor) targets it.

## O. Security (cross-cutting)

- **TC-SEC-01 · Security headers** — P1 — Steps: `curl -I https://<host>/sign-in`. Expected:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a `Content-Security-Policy` with
  `script-src 'self' 'nonce-…' 'strict-dynamic'` plus `base-uri`/`frame-ancestors`/`object-src`
  (emitted per-request by `src/proxy.ts`), `Referrer-Policy`, `Permissions-Policy`, and HSTS.
- **TC-SEC-02 · Auth rate limiting (production)** — P2 — Steps: in a production build, submit many
  rapid sign-in attempts. Expected: throttled (≈3 / 10s on sign-in).
- **TC-SEC-03 · Tenant isolation** — P1 — Expected: no user/workspace can read another's documents,
  brags, attachments, search results, or share links through any surface.
- **TC-SEC-04 · Private never leaks** — P1 — Expected: a private brag is absent from every share and
  from a default export.
- **TC-SEC-05 · Attachments never public** — P1 — Expected: every attachment requires owner session
  or a valid (and, if set, unlocked) share token.
- **TC-SEC-06 · Dead tokens** — P1 — Expected: revoked/expired/unknown share & unsubscribe tokens
  resolve to nothing / a friendly 404.
- **TC-SEC-07 · CSP script-src nonce** — P2 — security — Steps: load any page twice and compare the
  `Content-Security-Policy` response header; view source and check the `<script>` tags; watch the
  browser console. Expected: a **fresh** `script-src 'nonce-…'` each load, matching the `nonce` on
  every Next script; **no CSP violations** and the app stays interactive. A production build carries
  **no** `'unsafe-eval'`.

## P. UX & responsiveness

- **TC-UX-01 · Mobile layout** — P2 — Steps: view at 375px width. Expected: header, timeline, and
  filters work with no horizontal overflow.
- **TC-UX-02 · Loading states** — P3 — Expected: skeletons on dashboard/document/search while loading.
- **TC-UX-03 · Error boundary** — P3 — Expected: an in-chrome error page with a retry.
- **TC-UX-04 · Not-found** — P2 — Expected: an in-chrome "not found" for a missing/unowned document.

---

## Appendix — Per-mode smoke test (release acceptance)

A fast end-to-end pass mapping the PLAN §11 success criteria. Run on a **fresh** instance.

**`private-solo`**

1. `docker compose up` → `/setup` → create owner + workspace.
2. Log your first brag (quick-add) — target < 2 minutes total, < 30s for the brag.
3. Confirm you never see organization / member chrome.
4. Create a share link, open it on a phone — clean, branded, login-free; a private brag is invisible.
5. Export the document to Markdown — everything is there.

**`private-org`**

1. `/setup` → create owner + organization (set name, logo, accent).
2. Invite the first developer by email — target < 5 minutes from setup to sent invite.
3. Accept the invitation as that developer → they land in the workspace as a member.
4. Confirm a member cannot reach `/admin` and cannot create an account without an invitation.
5. Transfer ownership and confirm exactly one owner remains.
