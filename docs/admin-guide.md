# Admin guide

For workspace **owners** and **admins** (organizations), plus the hosted
**instance superadmin**. Workspace branding and member management are live;
member removal and ownership transfer are the next Phase 2 slice.

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

## Managing members

From **`/admin/members`** (organizations only — personal workspaces have no
member surface) an owner/admin can:

- **See the team** — each member's role, when they joined, and when they were
  last active.
- **Invite** one or more people at once (paste several addresses) with a role of
  Member or Admin.
- **Resend or revoke** a pending invitation.
- **Change a member's role.** Better Auth enforces the rules: only the owner can
  promote someone to owner or change the owner's role; admins can move people
  between Member and Admin but can never demote or remove the owner.

**Removing a member** (export-then-delete) and **ownership transfer** are the
next Phase 2 slice. (The removal export bundle fills in once export ships in
Phase 7; there is no brag data to export until Phase 3.)

## Hosted: instance superadmin

On a `hosted` instance a seeded **superadmin** manages workspaces, users, and
storage quotas for abuse control — and, like workspace admins, never reads brag
content. Lands in Phase 10.
