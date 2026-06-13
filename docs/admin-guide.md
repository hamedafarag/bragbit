# Admin guide

For workspace **owners** and **admins** (organizations), plus the hosted
**instance superadmin**. This page documents the membership model that's in place
today; the in-app administration UI (branding, member management, the invite
console) lands in Phase 2.

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
