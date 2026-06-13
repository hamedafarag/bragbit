# User guide

How to get into BragBit and manage your account. The brag workflow itself
(documents, quick-add, timeline, sharing, export) lands across Phases 3–8 and is
outlined at the end.

## Getting into BragBit

How you first get an account depends on how the instance is run (see
[Instance modes](instance-modes.md)):

- **Self-hosted, solo (`private-solo`)** — the first visit opens a one-time setup
  wizard. You create the owner account and your workspace and are signed straight
  in; the wizard then closes for good.
- **Self-hosted, organization (`private-org`)** — an admin invites you by email
  (see the [Admin guide](admin-guide.md)). Open the invitation link, set your name
  and a password, and you're in. There is no open sign-up.
- **Hosted (a shared instance)** — open sign-up with email verification (ships in
  v1.1).

### Signing in

Go to `/sign-in` and enter your email and password. If the operator has
configured GitHub or Google, a **Continue with …** button appears as well. On a
self-hosted instance those sign you into an **existing** account only — they
don't create one — so use the provider whose email matches your account.

### Verifying your email

BragBit requires a verified email, so you can't sign in until you've confirmed
yours. After sign-up you get a verification link by email; lost it? Request a new
one from `/verify-email`. Invited organization members are already verified — the
invitation link is proof you own that address.

### Resetting your password

Forgot it? Use **Forgot password?** on the sign-in page. We email a reset link
(valid for a short window); follow it to choose a new password, then sign in.

## Your profile & account

- **Profile** (`/profile`) — set your display name, role title, team, and bio (how
  you appear on your timeline and on documents you share), and upload an avatar
  (PNG/JPEG/WebP/GIF, up to 5 MB).
- **Account settings** (`/settings`):
  - **Email** — request a new address and confirm it from a link sent to your
    **current** inbox; the change applies only after you click that link.
  - **Password** — change it any time; this signs out your other sessions.
  - **Delete account** — permanently removes your account and data. On a personal
    (solo) instance this also deletes the workspace, returning the instance to its
    first-run setup state.

## The brag workflow

> Outlined here; built across Phases 3–8.

- Documents (a document = a review period: "2026", "H1 2026", "Promo case")
- The quick-add flow — only a title is required; the formula is
  _what you did + why it mattered + the measurable result_
- Tags, categories, filtering & search
- Attachments & links
- Sharing (read-only links, optional password, per-brag privacy)
- Export (Markdown / PDF / JSON) and weekly reminders
