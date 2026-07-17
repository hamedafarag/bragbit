# User guide

How to get into BragBit, manage your account, and use the product day to day.

## Getting into BragBit

How you first get an account depends on how the instance is run (see
[Instance modes](instance-modes.md)):

- **Self-hosted, solo (`private-solo`)** — the first visit opens a one-time setup wizard. You create
  the owner account and your workspace and are signed straight in; the wizard then closes for good.
- **Self-hosted, organization (`private-org`)** — an admin invites you by email (see the
  [Admin guide](admin-guide.md)). Open the invitation link, set your name and a password, and you're
  in. There is no open sign-up.

### Signing in

Go to `/sign-in` and enter your email and password. If the operator has configured GitHub or Google,
a **Continue with …** button appears as well. On a self-hosted instance those sign you into an
**existing** account only — they don't create one — so use the provider whose email matches your
account.

### Verifying your email

BragBit requires a verified email, so you can't sign in until you've confirmed yours. After sign-up
you get a verification link by email; lost it? Request a new one from `/verify-email`. Invited
organization members are already verified — the invitation link is proof you own that address.

### Resetting your password

Forgot it? Use **Forgot password?** on the sign-in page. We email a reset link (valid for a short
window); follow it to choose a new password, then sign in.

## Your profile & account

- **Profile** (`/profile`) — set your display name, role title, team, and bio (how you appear on your
  timeline and on documents you share), and upload an avatar (PNG/JPEG/WebP/GIF, up to 5 MB).
- **Account settings** (`/settings`):
  - **Email** — request a new address and confirm it from a link sent to your **current** inbox; the
    change applies only after you click that link.
  - **Password** — change it any time; this signs out your other sessions.
  - **Weekly reminders** — opt in to a nudge on the day and time zone you choose (see below).
  - **Download your data** — export everything as JSON (see [Export](#export)).
  - **Delete account** — permanently removes your account and data. On a personal (solo) instance
    this also deletes the workspace, returning the instance to its first-run setup state.

## Documents

Your work is organized into **documents**, each a review period — "2026", "H1 2026", a promotion
case. From the dashboard (`/dashboard`) you create a document (a title is all that's required;
optionally a subtitle, a period, and Markdown goals), edit it, archive it (reversibly — archived
documents collapse into a restorable list), or delete it (which removes its brags). Documents are
private to you; an admin can't read them.

## Logging a brag

A **brag** is one logged win inside a document. Capture is meant to take seconds:

- **Quick-add** — on a document page, type a title into the quick-add bar and save. The date defaults
  to today. Press <kbd>N</kbd> anywhere on the page to jump to it.
- **Add with details** — opens the full editor: a date, a category (the eight-color taxonomy), a
  status (shipped or in progress), an impact line, collaborators, attribution (for recognition), and
  a Markdown description with a Write/Preview toggle.

The placeholder teaches the formula the whole genre runs on —
_what you did + why it mattered + the measurable result_ (e.g. "Redesigned checkout, cutting cart
abandonment 40% → 28%").

### Links, attachments & tags

- **Links** — attach labeled links (a PR, a doc, a dashboard) to a brag.
- **Attachments** — upload files of any allowed type (screenshots, PDFs, praise emails) up to the
  instance's size cap. They're private — streamed through an authorizing route, never a public URL —
  and show as paperclip chips.
- **Tags** — add tags as you type; they're reused across your brags and shown as monochrome `#name`
  chips.

### Privacy

Mark any brag **Private** to keep it out of shared links and exports — it shows only to you, with a
dashed "Private" treatment. Everything else is shared by default (visible in a share link you create,
never to other members automatically).

## The timeline, filtering & search

A document renders as a **month-grouped timeline** — newest first, with sticky month headers, a
status node on each entry (solid = shipped, hollow = in progress), category colors, and
link/tag/attachment chips. Click a brag's title for a focused detail view with the full rendered
Markdown, attachments (with image previews), links, and collaborators.

Filter the timeline by category, tag, or date range from the filter bar (the URL updates, so a
filtered view is shareable). The header search box runs full-text search across all your documents in
the workspace and deep-links straight to a matching brag.

## Sharing

From a document, open **Share** to mint a secret, read-only link — anyone with the URL sees a clean,
workspace-branded, month-grouped timeline with no login. You can:

- **Copy** the link, **rotate** it (which instantly kills the old URL), or **stop sharing**.
- Set an optional **password** (the visitor unlocks once, then it's remembered on their device).
- Trust that **private brags never appear** — they're filtered out server-side — and that the page is
  `noindex`. You'll also see when the link was last opened.

## Export

Your data is always yours to take:

- **Markdown** — download a document as a clean Markdown file (metadata, goals, then wins grouped by
  month with links, an attachment manifest, collaborators, and tags).
- **PDF** — open the print view and use your browser's Save as PDF; it's workspace-branded with each
  month on its own page.
- **JSON** — from Settings, download your entire dataset (every document and brag — archived and
  private included — with links, attachment metadata, and tags) as one portable file.

By default exports exclude private brags; you can opt to include them in your own copy.

## Weekly reminders

In Settings, opt in to a weekly reminder. Pick a day and your time zone, and BragBit emails a
"What did you ship this week?" nudge — workspace-branded, with a one-tap link to log a win — on your
chosen day, in your zone. Every reminder has a one-click unsubscribe.

## Trying the demo

Evaluating BragBit locally? The repo ships a demo seed that fills a fresh database with a sample
workspace, an owner account, and a populated "2026" document:

```bash
pnpm seed:demo      # run against the database in your .env
```

Then sign in as `demo@bragbit.local` / `demobragbit` to explore a real timeline. It's idempotent and
meant for a fresh database — see [Contributing](../CONTRIBUTING.md) for the local dev stack.
