# Admin guide

For workspace **owners** and **admins** (organizations), plus the hosted
**instance superadmin**. Workspace branding is live; member management and the
invite console are the next Phase 2 slice.

## Workspace branding

At **`/admin`** (owner/admin only) you can set the workspace's:

- **Name** — shown in the app header, on the sign-in page, and on shared documents.
- **Accent color** — a validated hex with a live preview; it tints buttons,
  highlights, and links throughout BragBit, applied through a `--primary` CSS
  variable so the whole app re-themes at once.
- **Logo** — replaces the wordmark in the header and on the sign-in page (and,
  later, share pages). Logos are public assets; other uploads are not.

A **personal** workspace has the same branding controls (useful for a
freelancer's client-facing share pages) but no member/invite surface.

## Roles & permissions

Every workspace has three roles:

- **Owner** — the workspace creator (the setup user, or the org creator on a
  hosted instance). Exactly one per workspace; transferable, but never demotable
  or removable by an admin.
- **Admin** — manages the workspace: branding, members, and invitations.
- **Member** — uses the product.

**Admins manage the workspace, never members' brag content.** Brags are private
to each member regardless of role — an admin, and the hosted superadmin, can
never read another person's entries. A personal (`private-solo`) workspace has a
single owner and no member/invite surface at all.

## Invitations (organizations)

Organizations are **invitation-only**: there is no open sign-up on a `private-org`
instance, so a new account can be created only by accepting an invitation. An
invitation is:

- created for a specific **email + role** (admin or member);
- delivered as a branded email with a tokenized link;
- **single-use** and **expires after 7 days** (re-inviting an address revokes the
  prior token);
- **bound to the invited address** — the invitee can register only as that email,
  and verification is satisfied by construction (the link was sent to that inbox).

Opening the link lands the invitee on an accept page where they set a name and
password; accepting creates their membership and signs them in.

> The flow above — invite email → accept → member created — is in place and
> tested. The admin UI to **send and manage** invitations from inside the app
> (list, resend, revoke, change role) lands in **Phase 2**, together with
> workspace branding and member management. **Removing a member** is
> _export-then-delete_: the member receives a portable export, then their data is
> purged from the workspace — also Phase 2.

## Ownership transfer

Owner-only, and atomic; an admin can never demote or remove the owner. Lands in
Phase 2.

## Hosted: instance superadmin

On a `hosted` instance a seeded **superadmin** manages workspaces, users, and
storage quotas for abuse control — and, like workspace admins, never reads brag
content. Lands in Phase 10.
